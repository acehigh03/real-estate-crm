import { createClient } from "@/lib/supabase/server";
import { getInboxData } from "@/lib/data";
import { InboxClient } from "@/components/inbox/inbox-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; lead?: string }>;
}) {
  const { new: openComposer, lead: leadParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let leads = [] as Awaited<ReturnType<typeof getInboxData>>["leads"];
  let messages = [] as Awaited<ReturnType<typeof getInboxData>>["messages"];
  let campaigns = [] as Awaited<ReturnType<typeof getInboxData>>["campaigns"];

  try {
    ({ leads, messages, campaigns } = await getInboxData());
  } catch (error) {
    console.error("inbox page data failed:", error);
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
      console.error("inbox sentiments failed:", error);
    }
  }

  return (
    <InboxClient
      initialLeads={leads}
      initialMessages={messages}
      initialCampaigns={campaigns}
      initialSentiments={sentiments}
      userId={user?.id ?? ""}
      autoOpenComposer={openComposer === "1"}
      initialLeadId={leadParam ?? null}
    />
  );
}
