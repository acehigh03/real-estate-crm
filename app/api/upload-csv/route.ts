import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { parseLeadCsv } from "@/lib/csv/parse-leads";
import { classifyLeadMock } from "@/lib/ai/classify-lead";
import { getRouteUser } from "@/lib/route-user";
import { buildFirstSmsForLead } from "@/lib/sms/templates";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelnyxMessage, TelnyxSendError } from "@/lib/telnyx/send-sms";
import { isInsideWindow, nextWindowOpenUTC } from "@/lib/send-window";
import type { LeadPriority, LeadStage, CampaignType } from "@/types/database";

const VALID_CAMPAIGN_TYPES = new Set<CampaignType>([
  "cash_offer",
  "foreclosure_help",
  "probate",
  "tax_sale",
]);

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

  // Optional campaign context from the import modal
  const campaignId = (formData.get("campaign_id") as string | null) || null;
  const rawCampaignType = formData.get("campaign_type") as string | null;
  const campaignType: CampaignType | null =
    rawCampaignType && VALID_CAMPAIGN_TYPES.has(rawCampaignType as CampaignType)
      ? (rawCampaignType as CampaignType)
      : null;

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
      lead_score: classify.motivationScore,
      campaign_id: campaignId,
      stage: (
        row.status === "Hot"
          ? "Hot Lead"
          : row.status === "Replied"
            ? "Replied"
            : row.status === "Contacted"
              ? "Contacted"
              : row.status === "Dead" || row.status === "DNC"
                ? "Closed"
                : "New"
      ) as LeadStage,
      is_dnc: row.status === "DNC",
      dnc_reason: row.status === "DNC" ? "Imported as DNC" : null,
      priority: (
        classify.classification === "HOT"
          ? "high"
          : classify.classification === "WARM"
            ? "medium"
            : "low"
      ) as LeadPriority,
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

  // 4. Fetch SMS settings for this user
  const { data: smsSettings } = await supabaseAdmin
    .from("sms_settings")
    .select("auto_send_enabled, send_window_start, send_window_end, timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  const autoSendEnabled = smsSettings?.auto_send_enabled ?? false;
  const insideWindow =
    autoSendEnabled &&
    smsSettings &&
    isInsideWindow(
      smsSettings.send_window_start,
      smsSettings.send_window_end,
      smsSettings.timezone
    );

  // 5. Send first SMS to every new, non-DNC lead (or queue if outside window)
  let messagedCount = 0;
  let queuedCount = 0;

  if (newRows.length > 0) {
    const newPhones = newRows.map((r) => r.phone_normalized);
    const { data: smsTargets } = await supabaseAdmin
      .from("leads")
      .select("id, first_name, property_address, phone_normalized, status, tag, lead_source, is_dnc")
      .eq("user_id", user.id)
      .in("phone_normalized", newPhones);

    const now = new Date().toISOString();

    for (const lead of smsTargets ?? []) {
      if (lead.status === "DNC" || lead.is_dnc) continue;

      const rendered = buildFirstSmsForLead(
        {
          id: lead.id,
          phone_normalized: lead.phone_normalized,
          first_name: lead.first_name,
          property_address: lead.property_address,
          tag: lead.tag,
          lead_source: lead.lead_source,
        },
        campaignType ?? undefined
      );
      const text = rendered.message;

      // Queue the message if auto-send is on but we're outside the window
      if (autoSendEnabled && !insideWindow && smsSettings) {
        const scheduledFor = nextWindowOpenUTC(
          smsSettings.send_window_start,
          smsSettings.timezone
        ).toISOString();

        await supabaseAdmin.from("sms_queue").insert({
          lead_id: lead.id,
          message: text,
          status: "pending",
          scheduled_for: scheduledFor,
        });

        queuedCount++;
        continue;
      }

      // Send immediately (auto-send off = send right away; inside window = send right away)
      try {
        const telnyxResult = await sendTelnyxMessage({
          to: lead.phone_normalized,
          text,
        });

      await supabaseAdmin.from("messages").insert({
        user_id: user.id,
        lead_id: lead.id,
        phone: lead.phone_normalized,
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
            stage: "Contacted",
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

  // Update campaign totals if this import was tied to a campaign
  if (campaignId) {
    await supabaseAdmin
      .from("campaigns")
      .update({
        total_leads: newRows.length,
        messaged_count: messagedCount,
      })
      .eq("id", campaignId)
      .eq("user_id", user.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");
  revalidatePath("/campaigns");

  // Best-effort import log — table may not exist in all environments
  await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("import_logs" as any)
    .insert({
      user_id: user.id,
      file_name: (file as File).name || "upload.csv",
      total_rows: parsedRows.length + skippedCount,
      imported_count: newRows.length,
      messaged_count: messagedCount,
      skipped_count: skippedCount,
      failed_count: Math.max(0, newRows.length - messagedCount),
    })
    .then(() => {}, () => {});

  return NextResponse.json({
    success: true,
    imported: newRows.length,
    messaged: messagedCount,
    queued: queuedCount,
    skipped: skippedCount,
  });
}
