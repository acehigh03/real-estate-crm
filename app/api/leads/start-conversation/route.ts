import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { sendSmsToLead } from "@/lib/leads/send-lead-sms";
import { getRouteUser } from "@/lib/route-user";
import { normalizePhone } from "@/lib/utils";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const schema = z.object({
  phone: z.string().trim().min(1, "Phone number is required."),
  name: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().min(1, "Message is required.").max(1000, "Message is too long."),
});

/**
 * POST /api/leads/start-conversation
 *
 * Modal flow: find-or-create the lead for a phone number, text them, and return both the
 * lead and the saved message so the UI can update without a refresh.
 *
 * All database access runs as the signed-in user (row-level security), so this route works
 * without the service-role key.
 */
export const POST = withErrorHandling("api/leads/start-conversation", async (request: Request) => {
  const { supabase, user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
  }

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!/^\+\d{10,15}$/.test(phone)) {
    return NextResponse.json(
      { error: "Enter a valid phone number, e.g. (713) 555-0123." },
      { status: 400 }
    );
  }

  const findLead = () =>
    supabase.from("leads").select("*").eq("user_id", user.id).eq("phone", phone).limit(1).maybeSingle();

  const { data: existing, error: findError } = await findLead();
  if (findError) {
    logError("api/leads/start-conversation", findError, { step: "find lead" });
    return NextResponse.json({ error: userFacingError(findError) }, { status: 500 });
  }

  let lead: Lead | null = existing;
  let created = false;

  if (!lead) {
    const [firstName = "", ...rest] = parsed.data.name ? parsed.data.name.split(/\s+/) : [];

    const { data: inserted, error: insertError } = await supabase
      .from("leads")
      .insert({
        user_id: user.id,
        first_name: firstName,
        last_name: rest.join(" "),
        phone,
        property_address: "",
        lead_source: "Manual Inbox",
        status: "New",
        stage: "New",
        classification: "UNKNOWN",
        motivation_score: 25,
        lead_score: 25,
        priority: "medium",
        is_dnc: false,
      })
      .select("*")
      .single();

    if (insertError?.code === "23505") {
      // Lost a race with another request creating the same lead — use theirs.
      const { data: raced } = await findLead();
      lead = raced;
    } else if (insertError || !inserted) {
      logError("api/leads/start-conversation", insertError, { step: "insert lead" });
      return NextResponse.json({ error: userFacingError(insertError, "Couldn't create the lead. Please try again.") }, { status: 500 });
    } else {
      lead = inserted;
      created = true;
    }
  }

  if (!lead) {
    return NextResponse.json({ error: "Couldn't create the lead. Please try again." }, { status: 500 });
  }

  const result = await sendSmsToLead({ db: supabase, userId: user.id, lead, message: parsed.data.message });

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");
  revalidatePath("/pipeline");

  if (!result.ok) {
    // The lead exists (it will show in the pipeline as New), but nothing was sent.
    return NextResponse.json(
      {
        error: created
          ? `Lead saved, but the text was not sent. ${result.error}`
          : result.error,
        lead,
        created,
      },
      { status: result.status }
    );
  }

  // Re-read so the caller gets the post-send status/stage rather than the stale row.
  const { data: refreshed } = await supabase.from("leads").select("*").eq("id", lead.id).maybeSingle();

  return NextResponse.json(
    {
      success: true,
      created,
      lead: refreshed ?? lead,
      message: result.message,
      warning: result.warning ?? null,
    },
    { status: created ? 201 : 200 }
  );
});
