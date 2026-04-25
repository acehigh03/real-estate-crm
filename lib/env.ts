import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELNYX_API_KEY: z.string().min(1).optional(),
  TELNYX_FROM_NUMBER: z.string().min(1).optional(),
  TELNYX_MESSAGING_PROFILE_ID: z.string().min(1).optional()
});

const telnyxSchema = z.object({
  TELNYX_API_KEY: z.string().min(1),
  TELNYX_FROM_NUMBER: z.string().min(1),
  TELNYX_MESSAGING_PROFILE_ID: z.string().min(1)
});

export function getEnv() {
  return serverSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TELNYX_API_KEY: process.env.TELNYX_API_KEY,
    TELNYX_FROM_NUMBER: process.env.TELNYX_FROM_NUMBER,
    TELNYX_MESSAGING_PROFILE_ID: process.env.TELNYX_MESSAGING_PROFILE_ID
  });
}

export function getTelnyxEnv() {
  return telnyxSchema.parse({
    TELNYX_API_KEY: process.env.TELNYX_API_KEY,
    TELNYX_FROM_NUMBER: process.env.TELNYX_FROM_NUMBER,
    TELNYX_MESSAGING_PROFILE_ID: process.env.TELNYX_MESSAGING_PROFILE_ID
  });
}