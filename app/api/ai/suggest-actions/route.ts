import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { parseSuggestedActions, ruleBasedActions, suggestActionsPrompt } from "@/lib/automation/ai-prompts";
import { callClaude } from "@/lib/automation/anthropic";
import { allowRequest } from "@/lib/automation/rate-limit";
import { REPLY_SENTIMENTS, TRIGGER_TYPES } from "@/lib/automation/rules";
import { getRouteUser } from "@/lib/route-user";

const schema = z.object({
  trigger_type: z.enum(TRIGGER_TYPES),
  trigger_value: z.string().trim().max(200).nullish(),
});

/**
 * POST /api/ai/suggest-actions — a suggested action chain for a trigger.
 * Uses Claude when configured; otherwise (or if the reply can't be parsed) sensible built-in
 * suggestions, so the button always does something useful.
 */
export const POST = withErrorHandling("api/ai/suggest-actions", async (request: Request) => {
  const { user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowRequest(`suggest:${user.id}`, 20, 60_000)) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { trigger_type, trigger_value } = parsed.data;
  if (trigger_type === "sentiment" && !(REPLY_SENTIMENTS as readonly string[]).includes(trigger_value ?? "")) {
    return NextResponse.json({ error: "Choose a sentiment first." }, { status: 400 });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const text = await callClaude({ prompt: suggestActionsPrompt(trigger_type, trigger_value), maxTokens: 500, timeoutMs: 15_000 });
      const actions = parseSuggestedActions(text, trigger_type, trigger_value);
      if (actions) return NextResponse.json({ actions, source: "ai" });
    } catch (error) {
      console.error("[api/ai/suggest-actions] AI failed; using built-in suggestions:", error instanceof Error ? error.message : error);
    }
  }
  return NextResponse.json({ actions: ruleBasedActions(trigger_type, trigger_value), source: "rules" });
});
