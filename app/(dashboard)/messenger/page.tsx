import { createClient } from "@/lib/supabase/server";
import { getInboxData } from "@/lib/data";
import { MessengerClient } from "@/components/messenger/messenger-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function MessengerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let leads: Awaited<ReturnType<typeof getInboxData>>["leads"] = [];
  let messages: Awaited<ReturnType<typeof getInboxData>>["messages"] = [];

  try {
    ({ leads, messages } = await getInboxData());
  } catch (error) {
    console.error("messenger page data failed:", error);
  }

  // Reply sentiment badges. Best-effort: if the table isn't there yet the inbox still loads.
  const sentiments: Record<string, string> = {};
  if (user) {
    try {
      const { data } = await getSupabaseAdmin()
        .from("reply_classifications")
        .select("message_id, sentiment")
        .eq("user_id", user.id)
        .order("classified_at", { ascending: false })
        .limit(1000);
      for (const row of data ?? []) if (row.message_id && row.sentiment) sentiments[row.message_id] = row.sentiment;
    } catch (error) {
      console.error("messenger sentiments failed:", error);
    }
  }

  return (
    <MessengerClient
      initialLeads={leads}
      initialMessages={messages}
      initialSentiments={sentiments}
      userId={user?.id ?? ""}
    />
  );
}
