import { createClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let checkedProjectRef = false;

/**
 * Legacy service-role keys are JWTs whose `ref` claim is the project they belong to. A key
 * copied from another project is rejected by PostgREST with a bare "Invalid API key", which
 * is very hard to diagnose — so call it out once, loudly, at client creation.
 */
function warnIfKeyProjectMismatch(url: string, key: string) {
  if (checkedProjectRef) return;
  checkedProjectRef = true;

  try {
    const [, payload] = key.split(".");
    if (!payload) return;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { ref?: string };
    const urlRef = new URL(url).hostname.split(".")[0];
    if (claims.ref && claims.ref !== urlRef) {
      console.error(
        `[supabase-admin] SUPABASE_SERVICE_ROLE_KEY belongs to project "${claims.ref}" but SUPABASE_URL points at "${urlRef}". ` +
          "Every server-side database call will fail with 401 Invalid API key until this is fixed."
      );
    }
  } catch {
    // Not a JWT (e.g. a new-style sb_secret_ key) — nothing to compare.
  }
}

export function getSupabaseAdmin() {
  const env = getEnv();
  warnIfKeyProjectMismatch(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
