import { ConversationList } from "@/components/inbox/conversation-list";
import { getInboxData } from "@/lib/data";

export default async function InboxPage() {
  const { leads, messages } = await getInboxData();

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Messaging</p>
        <h1 className="text-3xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-2 text-sm text-muted">
          View inbound replies matched to leads and continue one-to-one conversations through Telnyx.
        </p>
      </section>

      <ConversationList leads={leads} messages={messages} />
    </div>
  );
}
