import { createClient } from "@/lib/supabase/server";
import { ImportClient } from "@/components/import/import-client";

export default async function ImportPage() {
  let campaigns: { id: string; name: string }[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      campaigns = (data ?? []) as { id: string; name: string }[];
    }
  } catch (error) {
    console.error("import page data failed:", error);
  }

  return <ImportClient campaigns={campaigns} />;
}
