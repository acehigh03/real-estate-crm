import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Authenticates the caller from their session cookie, then hands back the service-role client.
 * The service role bypasses row-level security, so EVERY query made with it must filter by
 * `user.id` (or be checked against an owned row) — that is what keeps users apart.
 */
export async function getAuthedAdmin() {
  const { user } = await getRouteUser();
  if (!user) return null;
  return { admin: getSupabaseAdmin(), user };
}
