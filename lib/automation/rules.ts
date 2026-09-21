// Pure automation rules: templates, sender rotation, trigger/condition matching, action schemas.
// No server imports, so it can be unit-tested and shared by API routes, the cron and the webhook.
import { z } from "zod";

// ── Sender numbers ─────────────────────────────────────────────────────────────────────────
export const DEFAULT_SENDER_NUMBERS = ["+18327870948", "+18327370324", "+18322254849"];

/** TELNYX_SENDER_NUMBERS (comma separated E.164) overrides the built-in list. */
export function senderNumbers(envValue: string | undefined = process.env.TELNYX_SENDER_NUMBERS): string[] {
  const parsed = (envValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^\+[1-9]\d{7,14}$/.test(value));
  return parsed.length ? parsed : DEFAULT_SENDER_NUMBERS;
}

/**
 * Spreads leads evenly across the sender numbers, but keeps every lead on ONE number so a
 * seller always sees the same sender in their thread (switching numbers mid-conversation
 * confuses sellers and looks like snowshoeing to carriers).
 */
export function pickSenderNumber(leadId: string, numbers: string[] = senderNumbers()): string {
  let hash = 2166136261;
  for (let index = 0; index < leadId.length; index += 1) {
    hash ^= leadId.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return numbers[hash % numbers.length];
}

// ── Templates ──────────────────────────────────────────────────────────────────────────────
export interface TemplateLead {
  first_name?: string | null;
  last_name?: string | null;
  property_address?: string | null;
  city?: string | null;
}

/** Supports [[first_name]] / [[address]] (the automation syntax), the older {{first_name}} form, and {{name}} (= first name). */
export function renderTemplate(template: string, lead: TemplateLead): string {
  const fields: Record<string, string> = {
    first_name: lead.first_name?.trim() || "there",
    name: lead.first_name?.trim() || "there",
    last_name: lead.last_name?.trim() || "",
    address: lead.property_address?.trim() || "your property",
    property_address: lead.property_address?.trim() || "your property",
    city: lead.city?.trim() || "",
  };
  return template
    .replace(/\[\[\s*(first_name|name|last_name|address|property_address|city)\s*\]\]/g, (_, key: string) => fields[key])
    .replace(/{{\s*(first_name|name|last_name|address|property_address|city)\s*}}/g, (_, key: string) => fields[key]);
}

// ── Vocabulary ─────────────────────────────────────────────────────────────────────────────
export const REPLY_SENTIMENTS = ["interested", "maybe", "not_interested", "stop", "question"] as const;
export type ReplySentimentValue = (typeof REPLY_SENTIMENTS)[number];
export const TRIGGER_TYPES = ["keyword", "any_reply", "first_reply", "sentiment"] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

/** Lead stage values a condition or "Move Stage" action can use (same set the pipeline writes). */
export const STAGE_OPTIONS = ["New Leads", "Contacted", "Replied", "Qualified", "Offer Sent", "Under Contract", "Closed", "Dead"] as const;
export type StageOption = (typeof STAGE_OPTIONS)[number];

// What "Move Stage" writes, kept in step with updatePipelineStage() in app/actions.ts.
export const STAGE_WRITE: Record<StageOption, { status: string; stage: string; classification?: string }> = {
  "New Leads": { status: "New", stage: "New" },
  Contacted: { status: "Contacted", stage: "Contacted" },
  Replied: { status: "Replied", stage: "Replied" },
  Qualified: { status: "Hot", stage: "Hot Lead", classification: "HOT" },
  "Offer Sent": { status: "Contacted", stage: "Offer Sent" },
  "Under Contract": { status: "Hot", stage: "Under Contract", classification: "HOT" },
  Closed: { status: "Hot", stage: "Closed", classification: "HOT" },
  Dead: { status: "Dead", stage: "Dead", classification: "DEAD" },
};

// ── Schemas (shared by the API routes and the editor) ──────────────────────────────────────
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("send_sms"), message: z.string().trim().min(1).max(320) }),
  z.object({ type: z.literal("tag_lead"), tag: z.string().trim().min(1).max(40).regex(/^[^,]+$/, "Tags can't contain commas") }),
  z.object({ type: z.literal("update_stage"), stage: z.enum(STAGE_OPTIONS) }),
  z.object({ type: z.literal("notify"), message: z.string().trim().max(200).optional() }),
  z.object({ type: z.literal("cancel_drips") }),
]);
export type AutomationAction = z.infer<typeof actionSchema>;

export const conditionsSchema = z
  .object({
    stage: z.enum(STAGE_OPTIONS).optional(),
    tag: z.string().trim().max(40).optional(),
  })
  .default({});
export type AutomationConditions = z.infer<typeof conditionsSchema>;

export const autoResponderInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    is_active: z.boolean().default(true),
    trigger_type: z.enum(TRIGGER_TYPES),
    trigger_value: z.string().trim().max(200).nullish(),
    conditions: conditionsSchema,
    actions: z.array(actionSchema).min(1, "Add at least one action").max(8),
  })
  .superRefine((value, ctx) => {
    if (value.trigger_type === "keyword" && !value.trigger_value?.trim()) {
      ctx.addIssue({ code: "custom", path: ["trigger_value"], message: "Enter at least one keyword" });
    }
    if (value.trigger_type === "sentiment" && !(REPLY_SENTIMENTS as readonly string[]).includes(value.trigger_value ?? "")) {
      ctx.addIssue({ code: "custom", path: ["trigger_value"], message: "Choose a sentiment" });
    }
  });

// ── Matching ───────────────────────────────────────────────────────────────────────────────
export interface ReplyContext {
  body: string;
  sentiment: ReplySentimentValue;
  isFirstReply: boolean;
}

export function keywordMatches(body: string, keywords: string | null | undefined): boolean {
  const list = (keywords ?? "")
    .split(/[,\n]/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return false;
  const text = body.toLowerCase();
  return list.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
  });
}

export function matchesTrigger(
  responder: { trigger_type: string; trigger_value: string | null },
  context: ReplyContext
): boolean {
  switch (responder.trigger_type) {
    case "any_reply":
      return true;
    case "first_reply":
      return context.isFirstReply;
    case "keyword":
      return keywordMatches(context.body, responder.trigger_value);
    case "sentiment":
      return responder.trigger_value === context.sentiment;
    default:
      return false;
  }
}

export function conditionsPass(
  conditions: unknown,
  lead: { stage: string | null; status: string; tag: string | null }
): boolean {
  const parsed = conditionsSchema.safeParse(conditions ?? {});
  if (!parsed.success) return false; // corrupt conditions: don't fire
  const { stage, tag } = parsed.data;
  if (stage) {
    // Compare against the written stage value for that pipeline bucket, or the raw stage.
    const wanted = STAGE_WRITE[stage];
    if (lead.stage !== wanted.stage && lead.stage !== stage) return false;
  }
  if (tag?.trim()) {
    const tags = (lead.tag ?? "").split(",").map((item) => item.trim().toLowerCase());
    if (!tags.includes(tag.trim().toLowerCase())) return false;
  }
  return true;
}

export function addTag(existing: string | null | undefined, tag: string): string {
  const tags = (existing ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!tags.some((item) => item.toLowerCase() === tag.toLowerCase())) tags.push(tag);
  return tags.join(", ");
}
