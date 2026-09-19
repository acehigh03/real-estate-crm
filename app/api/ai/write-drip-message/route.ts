import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { writeDripPrompt } from "@/lib/automation/ai-prompts";
import { AiNotConfiguredError, streamClaude } from "@/lib/automation/anthropic";
import { logError } from "@/lib/errors";
import { getRouteUser } from "@/lib/route-user";
import { allowRequest } from "@/lib/automation/rate-limit";

const schema = z.object({
  workflow_name: z.string().trim().max(120).default("Follow-up"),
  step_number: z.number().int().min(1).max(20),
  delay_minutes: z.number().int().min(0).max(525600).default(0),
  prior_messages: z.array(z.string().max(1600)).max(12).default([]),
});

/** POST /api/ai/write-drip-message — streams a suggested SMS as plain text. */
export const POST = withErrorHandling("api/ai/write-drip-message", async (request: Request) => {
  const { user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowRequest(`write:${user.id}`, 20, 60_000)) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const stream = await streamClaude({
      maxTokens: 120,
      prompt: writeDripPrompt({ workflowName: parsed.data.workflow_name, stepNumber: parsed.data.step_number, delayMinutes: parsed.data.delay_minutes, prior: parsed.data.prior_messages }),
    });
    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 503 });
    logError("api/ai/write-drip-message", error);
    return NextResponse.json({ error: "The AI writer is unavailable right now. Please try again." }, { status: 502 });
  }
});
