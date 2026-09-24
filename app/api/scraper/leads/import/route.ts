import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";

const schema = z.object({ id: z.union([z.string().min(1), z.number()]) });

export const POST = withErrorHandling("api/scraper/leads/import", async (request: Request) => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "A scraper lead is required." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: source, error: sourceError } = await admin
    .from("foreclosure_leads" as never)
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (sourceError || !source) {
    logError("api/scraper/leads/import", sourceError, { step: "load scraper lead" });
    return NextResponse.json({ error: "That scraper lead no longer exists." }, { status: 404 });
  }

  const row = source as Record<string, unknown>;
  const phone = normalizePhone(String(row.phone ?? ""));
  if (!/^\+\d{10,15}$/.test(phone)) {
    return NextResponse.json({ error: "This record needs a valid phone number before it can enter the CRM." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", user.id)
    .eq("phone", phone)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: userFacingError(existingError) }, { status: 500 });

  let leadId = existing?.id ?? null;
  let created = false;
  if (!leadId) {
    const fullName = String(row.full_name ?? "").trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = String(row.first_name ?? "").trim() || parts.shift() || "Unknown";
    const lastName = String(row.last_name ?? "").trim() || parts.join(" ");
    const caseNumber = String(row.case_number ?? "").trim();
    const hcad = String(row.hcad_account ?? "").trim();
    const notes = [caseNumber && `Case ${caseNumber}`, hcad && `HCAD ${hcad}`].filter(Boolean).join(" · ");

    const { data: inserted, error: insertError } = await supabase
      .from("leads")
      .insert({
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        phone,
        property_address: String(row.address ?? "").trim(),
        mailing_address: String(row.mailing_address ?? "").trim() || null,
        lead_source: `Scraper: ${String(row.source ?? "foreclosure")}`,
        notes_summary: notes || null,
        status: "New",
        stage: "New",
        classification: "UNKNOWN",
        motivation_score: 25,
        lead_score: 25,
        priority: "medium",
        is_dnc: false,
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      logError("api/scraper/leads/import", insertError, { step: "create CRM lead" });
      return NextResponse.json({ error: userFacingError(insertError, "Couldn't add this lead to the CRM.") }, { status: 500 });
    }
    leadId = inserted.id;
    created = true;
  }

  await admin.from("foreclosure_leads" as never).update({ crm_status: "imported" } as never).eq("id", parsed.data.id);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/scraper");
  return NextResponse.json({ ok: true, created, leadId });
});
