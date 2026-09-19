import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { processDueDrips } from "@/lib/automation/drip-runner";
import { logError } from "@/lib/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Constant-time comparison so the secret can't be guessed byte by byte. */
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: with no secret configured nobody is authorized (never "Bearer undefined").
  if (!secret || secret.length < 16) return false;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[cron/drip] CRON_SECRET is not set — refusing to run");
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueDrips(getSupabaseAdmin());
    return NextResponse.json(result);
  } catch (error) {
    // Never let a failure escape as a crash: report it and let the next run retry.
    logError("cron/drip", error);
    return NextResponse.json({ error: "Drip run failed", processed: 0, failed: 0, skipped: 0 }, { status: 500 });
  }
}

// Vercel Cron and the GitHub Actions scheduler use GET; POST is allowed for manual runs.
export const GET = run;
export const POST = run;
