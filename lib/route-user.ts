import { createClient } from "@/lib/supabase/server";

export async function getRouteUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}
