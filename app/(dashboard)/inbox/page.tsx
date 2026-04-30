import { createClient } from "@/lib/supabase/server";
import { getInboxData } from "@/lib/data";
import { InboxClient } from "@/components/inbox/inbox-client";

export default async function InboxPage() {
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

  return (
    <InboxClient
      initialLeads={leads}
      initialMessages={messages}
      initialCampaigns={campaigns}
      userId={user?.id ?? ""}
    />
  );
}
