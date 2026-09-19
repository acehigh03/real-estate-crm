import { formatDelay } from "@/lib/drips";
import { actionSchema, type AutomationAction, type ReplySentimentValue, type TriggerType } from "./rules";

const clean = (value: string, max: number) => value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export function writeDripPrompt(input: { workflowName: string; stepNumber: number; delayMinutes: number; prior: string[] }) {
  const prior = input.prior.length ? input.prior.slice(-6).map((message, index) => `${index + 1}. ${clean(message, 200)}`).join(" | ") : "none yet";
  return (
    `Write a short conversational SMS for step ${input.stepNumber} of a '${clean(input.workflowName, 80)}' real estate seller sequence. ` +
    `Delay from last: ${formatDelay(input.delayMinutes)}. Under 160 chars. Sound like a local investor named Sam. No hashtags. ` +
    `Opt-out only on step 1. Prior messages: ${prior}\n` +
    `Use [[first_name]] and [[address]] where natural. Reply with ONLY the message text: no quotes, no explanation.`
  );
}

/** Deterministic suggestions, used when AI is off or fails. */
export function ruleBasedActions(trigger: TriggerType, value: string | null | undefined): AutomationAction[] {
  if (trigger === "sentiment") {
    switch (value as ReplySentimentValue) {
      case "interested":
        return [
          { type: "notify", message: "Interested seller — call now" },
          { type: "tag_lead", tag: "Interested" },
          { type: "update_stage", stage: "Qualified" },
          { type: "cancel_drips" },
          { type: "send_sms", message: "Great, [[first_name]]! What's the best time today to call you about [[address]]?" },
        ];
      case "maybe":
        return [{ type: "tag_lead", tag: "Maybe" }, { type: "send_sms", message: "No problem, [[first_name]]. What would make selling [[address]] worth considering for you?" }];
      case "not_interested":
        return [{ type: "tag_lead", tag: "Not interested" }, { type: "update_stage", stage: "Dead" }, { type: "cancel_drips" }];
      case "stop":
        // Never a text back to an opted-out seller.
        return [{ type: "cancel_drips" }, { type: "tag_lead", tag: "Opted out" }];
      case "question":
        return [
          { type: "notify", message: "Seller asked a question" },
          { type: "send_sms", message: "Happy to explain, [[first_name]]. I'm Sam, a local investor buying homes as-is. Want a quick call?" },
        ];
    }
  }
  if (trigger === "first_reply") {
    return [{ type: "cancel_drips" }, { type: "tag_lead", tag: "Replied" }, { type: "send_sms", message: "Thanks for getting back to me, [[first_name]]! Are you the owner of [[address]]?" }];
  }
  if (trigger === "keyword") return [{ type: "notify", message: `Seller used "${clean(value ?? "", 40)}"` }, { type: "tag_lead", tag: clean(value ?? "Keyword", 30).split(",")[0].trim() || "Keyword" }];
  return [{ type: "notify" }, { type: "cancel_drips" }];
}

export function suggestActionsPrompt(trigger: TriggerType, value: string | null | undefined) {
  return (
    "You configure SMS auto-responders for a real estate investor texting motivated sellers. " +
    `Trigger: ${trigger}${value ? ` = "${clean(value, 60)}"` : ""}. ` +
    "Return ONLY a JSON array (2-4 items) of actions in order. Allowed items: " +
    '{"type":"send_sms","message":"<under 160 chars, may use [[first_name]] and [[address]]>"}, {"type":"tag_lead","tag":"<short>"}, ' +
    '{"type":"update_stage","stage":"New Leads|Contacted|Replied|Qualified|Offer Sent|Dead"}, {"type":"notify","message":"<short>"}, {"type":"cancel_drips"}. ' +
    "Never include send_sms when the trigger is the stop sentiment."
  );
}

export function parseSuggestedActions(text: string, trigger: TriggerType, value: string | null | undefined): AutomationAction[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as unknown[];
    const actions = raw.flatMap((item) => {
      const parsed = actionSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
    const safe = trigger === "sentiment" && value === "stop" ? actions.filter((action) => action.type !== "send_sms") : actions;
    return safe.length ? safe.slice(0, 6) : null;
  } catch {
    return null;
  }
}
