import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { parseLeadCsv } from "@/lib/csv/parse-leads";
import { classifyLeadMock } from "@/lib/ai/classify-lead";
import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelnyxMessage, TelnyxSendError } from "@/lib/telnyx/send-sms";
import { withStopLanguage } from "@/lib/utils";

function buildFirstSms(firstName: string, address: string): string {
  const intro = address
    ? `I came across your property at ${address} and wanted to reach out.`
    : `I wanted to reach out about a potential cash offer.`;
  const text = `Hi ${firstName}, this is Senay with Texas Relief Group. ${intro} Are you open to a cash offer? Reply YES or NO.`;
  return withStopLanguage(text);
}

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const { user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  let parsedRows: ReturnType<typeof parseLeadCsv>["rows"];
  let csvSkippedCount = 0;
  try {
    const csvText = await file.text();
    const parsed = parseLeadCsv(csvText);
    parsedRows = parsed.rows;
    csvSkippedCount = parsed.skippedCount;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "CSV parsing failed" },
      { status: 400 }
    );
  }

  if (parsedRows.length === 0) {
    return NextResponse.json({ error: "CSV contains no valid rows" }, { status: 400 });
  }

  // Deduplicate by phone_normalized — keep first occurrence
  const seenPhones = new Set<string>();
  const dedupedRows: typeof parsedRows = [];
  for (const row of parsedRows) {
    if (seenPhones.has(row.phone_normalized)) {
      csvSkippedCount++;
    } else {
      seenPhones.add(row.phone_normalized);
      dedupedRows.push(row);
    }
  }
  parsedRows = dedupedRows;

  // 1. Find which phones already exist for this user
  const incomingPhones = parsedRows.map((r) => r.phone_normalized);

  const { data: existingLeads } = await supabaseAdmin
    .from("leads")
    .select("phone_normalized")
    .eq("user_id", user.id)
    .in("phone_normalized", incomingPhones);

  const existingPhoneSet = new Set((existingLeads ?? []).map((l) => l.phone_normalized));

  const newRows = parsedRows.filter((r) => !existingPhoneSet.has(r.phone_normalized));
  const skippedCount = csvSkippedCount + (parsedRows.length - newRows.length);

  // 2. Upsert all rows (preserves existing-lead data for re-imports)
  const payload = parsedRows.map((row) => {
    const classify = classifyLeadMock({
      status: row.status,
      notesSummary: row.notes_summary,
      nextFollowUpAt: null,
    });
    return {
      ...row,
      classification: classify.classification,
      motivation_score: classify.motivationScore,
      user_id: user.id,
    };
  });

  const { error: upsertError } = await supabaseAdmin
    .from("leads")
    .upsert(payload, { onConflict: "user_id,phone_normalized" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // 3. Insert notes for new leads that have a notes_summary
  if (newRows.length > 0) {
    const newPhones = newRows.map((r) => r.phone_normalized);
    const { data: insertedLeads } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, notes_summary")
      .eq("user_id", user.id)
      .in("phone_normalized", newPhones);

    const noteRows = (insertedLeads ?? [])
      .filter((lead) => lead.notes_summary)
      .map((lead) => ({
        lead_id: lead.id,
        user_id: lead.user_id,
        body: lead.notes_summary as string,
      }));

    if (noteRows.length) {
      await supabaseAdmin.from("notes").insert(noteRows);
    }
  }

  // 4. Send first SMS to every new, non-DNC lead
  let messagedCount = 0;

  if (newRows.length > 0) {
    const newPhones = newRows.map((r) => r.phone_normalized);
    const { data: smsTargets } = await supabaseAdmin
      .from("leads")
      .select("id, first_name, property_address, phone_normalized, status")
      .eq("user_id", user.id)
      .in("phone_normalized", newPhones);

    const now = new Date().toISOString();

    for (const lead of smsTargets ?? []) {
      if (lead.status === "DNC") continue;

      const text = buildFirstSms(lead.first_name, lead.property_address);

      try {
        const telnyxResult = await sendTelnyxMessage({
          to: lead.phone_normalized,
          text,
        });

        await supabaseAdmin.from("messages").insert({
          user_id: user.id,
          lead_id: lead.id,
          direction: "outbound",
          body: text,
          to_number: lead.phone_normalized,
          status: telnyxResult?.to?.[0]?.status ?? "queued",
          telnyx_message_id: telnyxResult?.id ?? null,
        });

        await supabaseAdmin
          .from("leads")
          .update({
            status: "Contacted",
            last_contacted_at: now,
          })
          .eq("id", lead.id);

        messagedCount++;
      } catch (err) {
        // Telnyx not configured or send failed — lead is imported but not messaged
        if (!(err instanceof TelnyxSendError)) {
          console.error("Unexpected SMS error for lead", lead.id, err);
        }
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");

  return NextResponse.json({
    success: true,
    imported: newRows.length,
    messaged: messagedCount,
    skipped: skippedCount,
  });
}
