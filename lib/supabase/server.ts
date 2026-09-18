import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  type CookieToSet = { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] };

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        }
      }
    }
  );

  // @supabase/ssr@0.5 declares its return type with an older SupabaseClient generic
  // signature, which makes every table query resolve to `never` under supabase-js@2.10x.
  // The runtime object is identical, so re-type it to the supabase-js signature.
  return client as unknown as SupabaseClient<Database>;
}
