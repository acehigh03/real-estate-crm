import { createClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function getSupabaseAdmin() {
  const env = getEnv();

  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
