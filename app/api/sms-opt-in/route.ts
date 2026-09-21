import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const CONSENT_VERSION = "2026-09-21-v1";
const CONSENT_TEXT =
  "I agree to receive recurring marketing text messages from SSB Management regarding real estate and property services at the number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase. Mobile information and SMS consent will not be sold or shared with third parties for promotional or marketing purposes.";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(30),
  propertyAddress: z.string().trim().max(240).optional().default(""),
  consented: z.literal(true),
  website: z.string().max(0).optional().default(""),
});

function normalizeUsPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid name and mobile number, then check the consent box." }, { status: 400 });
  }

  const phoneNormalized = normalizeUsPhone(parsed.data.phone);
  if (!phoneNormalized) {
    return NextResponse.json({ error: "Enter a valid 10-digit U.S. mobile number." }, { status: 400 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = createHash("sha256")
    .update(`${process.env.SMS_CONSENT_HASH_SALT || "sellingmy.casa"}:${forwardedFor}`)
    .digest("hex");

  const { error } = await getSupabaseAdmin().from("sms_opt_ins").insert({
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    phone_normalized: phoneNormalized,
    property_address: parsed.data.propertyAddress || null,
    consented: true,
    consent_text: CONSENT_TEXT,
    consent_version: CONSENT_VERSION,
    source_url: new URL("/opt-in", request.url).toString(),
    user_agent: request.headers.get("user-agent"),
    ip_hash: ipHash,
  });

  if (error) {
    console.error("[sms-opt-in] Failed to record consent", error);
    return NextResponse.json(
      {
        error: "We could not save your request. Please try again.",
        reference: error.code || "DATABASE_ERROR",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
