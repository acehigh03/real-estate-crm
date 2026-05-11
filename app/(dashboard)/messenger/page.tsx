import { createClient } from "@/lib/supabase/server";
import { getInboxData } from "@/lib/data";
import { MessengerClient } from "@/components/messenger/messenger-client";

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

  return (
    <MessengerClient
      initialLeads={leads}
      initialMessages={messages}
      userId={user?.id ?? ""}
    />
  );
}
