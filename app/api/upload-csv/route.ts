import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { withErrorHandling } from "@/lib/api";
import { parseLeadCsv } from "@/lib/csv/parse-leads";
import { classifyLeadMock } from "@/lib/ai/classify-lead";
import { logError, userFacingError } from "@/lib/errors";
import { sendSmsToLead } from "@/lib/leads/send-lead-sms";
import { getRouteUser } from "@/lib/route-user";
import { renderTemplate } from "@/lib/sms/templates";
import { isInsideWindow, nextWindowOpenUTC } from "@/lib/send-window";
import { withStopLanguage } from "@/lib/utils";
import type { LeadPriority, LeadStage, CampaignType } from "@/types/database";

const VALID_CAMPAIGN_TYPES = new Set<CampaignType>([
  "cash_offer",
  "foreclosure_help",
  "probate",
  "tax_sale",
]);

export const POST = withErrorHandling("api/upload-csv", async (request: Request) => {
  // Runs as the signed-in user; row-level security scopes every query to their rows.
  const { supabase: db, user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload could not be read. Please try again." }, { status: 400 });
  }
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

  let campaignTemplate: string | null = null;
  if (campaignId) {
    const { data: campaign, error: campaignError } = await db
      .from("campaigns")
      .select("id, campaign_type, first_sms_template")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (campaignError) {
      logError("api/upload-csv", campaignError, { step: "load campaign" });
      return NextResponse.json({ error: userFacingError(campaignError) }, { status: 500 });
    }

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    campaignTemplate = campaign.first_sms_template?.trim() ?? null;
    if (!campaignTemplate) {
      return NextResponse.json(
        { error: "Please choose a campaign message before sending." },
        { status: 400 }
      );
    }
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

  const { data: existingLeads, error: existingLeadsError } = await db
    .from("leads")
    .select("phone")
    .eq("user_id", user.id)
    .in("phone", incomingPhones);

  if (existingLeadsError) {
    logError("api/upload-csv", existingLeadsError, { step: "look up existing leads" });
    return NextResponse.json({ error: userFacingError(existingLeadsError) }, { status: 500 });
  }

  const existingPhoneSet = new Set((existingLeads ?? []).map((l) => l.phone));

  const newRows = parsedRows.filter((r) => !existingPhoneSet.has(r.phone_normalized));
  const skippedCount = csvSkippedCount + (parsedRows.length - newRows.length);

  // 2. Insert only the NEW rows. Existing leads are left untouched: re-importing a CSV must
  // never reset a lead's status, classification or (critically) its DNC flag.
  const payload = newRows.map((row) => {
    const classify = classifyLeadMock({
      status: row.status,
      notesSummary: row.notes_summary,
      nextFollowUpAt: null,
    });
    const { phone_normalized: phoneNorm, phone: _rawPhone, ...rowRest } = row;
    return {
      ...rowRest,
      phone: phoneNorm,
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
              : row.status === "Dead"
                ? "Dead"
                : row.status === "DNC"
                  ? "DNC"
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

  if (payload.length > 0) {
    const { error: insertError } = await db.from("leads").insert(payload);

    if (insertError) {
      logError("api/upload-csv", insertError, { step: "insert leads", rows: payload.length });
      return NextResponse.json({ error: userFacingError(insertError, "Import failed. No leads were added.") }, { status: 500 });
    }
  }

  // 3. Insert notes for new leads that have a notes_summary
  if (newRows.length > 0) {
    const newPhones = newRows.map((r) => r.phone_normalized);
    const { data: insertedLeads, error: insertedLeadsError } = await db
      .from("leads")
      .select("id, user_id, notes_summary")
      .eq("user_id", user.id)
      .in("phone", newPhones);
    if (insertedLeadsError) logError("api/upload-csv", insertedLeadsError, { step: "reload inserted leads for notes" });

    const noteRows = (insertedLeads ?? [])
      .filter((lead) => lead.notes_summary)
      .map((lead) => ({
        lead_id: lead.id,
        user_id: lead.user_id,
        body: lead.notes_summary as string,
      }));

    if (noteRows.length) {
      const { error: notesError } = await db.from("notes").insert(noteRows);
      if (notesError) logError("api/upload-csv", notesError, { step: "insert import notes" });
    }
  }

  // 4. Fetch SMS settings for this user
  const { data: smsSettings, error: smsSettingsError } = await db
    .from("sms_settings")
    .select("auto_send_enabled, send_window_start, send_window_end, timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (smsSettingsError) logError("api/upload-csv", smsSettingsError, { step: "load sms_settings" });

  const autoSendEnabled = smsSettings?.auto_send_enabled ?? false;
  const insideWindow =
    autoSendEnabled &&
    smsSettings &&
    isInsideWindow(
      smsSettings.send_window_start,
      smsSettings.send_window_end,
      smsSettings.timezone
    );

  // 5. Send first SMS to every new, non-DNC lead (or queue if outside window).
  // With no campaign selected this is an import-only run ("No campaign — import only").
  let messagedCount = 0;
  let queuedCount = 0;
  let sendFailures = 0;
  let firstSendError: string | null = null;

  if (newRows.length > 0 && campaignTemplate) {
    const newPhones = newRows.map((r) => r.phone_normalized);
    const { data: smsTargets, error: smsTargetsError } = await db
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .in("phone", newPhones);
    if (smsTargetsError) logError("api/upload-csv", smsTargetsError, { step: "load imported leads for SMS" });

    for (const lead of smsTargets ?? []) {
      if (lead.status === "DNC" || lead.is_dnc) continue;

      const text = withStopLanguage(
        renderTemplate(campaignTemplate, {
          id: lead.id,
          phone_normalized: lead.phone,
          first_name: lead.first_name,
          property_address: lead.property_address,
          tag: lead.tag,
          lead_source: lead.lead_source,
        })
      );

      // Queue the message if auto-send is on but we're outside the window
      if (autoSendEnabled && !insideWindow && smsSettings) {
        const scheduledFor = nextWindowOpenUTC(
          smsSettings.send_window_start,
          smsSettings.timezone
        ).toISOString();

        const { error: queueError } = await db.from("sms_queue").insert({
          lead_id: lead.id,
          message: text,
          status: "pending",
          scheduled_for: scheduledFor,
        });

        if (queueError) {
          logError("api/upload-csv", queueError, { step: "queue SMS", leadId: lead.id });
          sendFailures++;
        } else {
          queuedCount++;
        }
        continue;
      }

      // Send immediately (auto-send off = send right away; inside window = send right away).
      // A failure here never aborts the import: the lead is saved, just not messaged.
      const result = await sendSmsToLead({ db, userId: user.id, lead, message: text });
      if (result.ok) {
        messagedCount++;
      } else {
        sendFailures++;
        firstSendError ??= result.error;
        console.error("[api/upload-csv] first SMS failed", { leadId: lead.id, error: result.error });
      }
    }
  }

  // Update campaign totals if this import was tied to a campaign
  if (campaignId) {
    const { error: campaignUpdateError } = await db
      .from("campaigns")
      .update({
        total_leads: newRows.length,
        messaged_count: messagedCount,
      })
      .eq("id", campaignId)
      .eq("user_id", user.id);
    if (campaignUpdateError) logError("api/upload-csv", campaignUpdateError, { step: "update campaign totals" });
  }

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");
  revalidatePath("/pipeline");
  revalidatePath("/campaigns");

  const { error: importLogError } = await db.from("import_logs").insert({
    user_id: user.id,
    file_name: file.name || "upload.csv",
    total_rows: parsedRows.length + csvSkippedCount,
    imported_count: newRows.length,
    messaged_count: messagedCount,
    skipped_count: skippedCount,
    failed_count: sendFailures,
  });
  if (importLogError) logError("api/upload-csv", importLogError, { step: "write import log" });

  return NextResponse.json({
    success: true,
    imported: newRows.length,
    messaged: messagedCount,
    queued: queuedCount,
    skipped: skippedCount,
    failed: sendFailures,
    send_error: firstSendError,
  });
});
