import { createClient } from "@/lib/supabase/server";
import { getInboxData } from "@/lib/data";
import { InboxClient } from "@/components/inbox/inbox-client";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { leads, messages } = await getInboxData();

  return (
    <InboxClient
      initialLeads={leads}
      initialMessages={messages}
      userId={user?.id ?? ""}
    />
  );
}
