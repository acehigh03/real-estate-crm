// "Unread" = a conversation whose newest message is an inbound reply that hasn't been opened.
// `read_at` may not exist yet (migration not applied) — then it reads as undefined/null and every
// conversation ending in an inbound reply counts as unread, which matches the old behaviour.
export interface UnreadMessage {
  lead_id: string | null;
  direction: string;
  created_at: string;
  read_at?: string | null;
}

export function unreadLeadIds(messages: UnreadMessage[]): Set<string> {
  const latest = new Map<string, UnreadMessage>();
  for (const message of messages) {
    if (!message.lead_id) continue;
    const current = latest.get(message.lead_id);
    if (!current || current.created_at < message.created_at) latest.set(message.lead_id, message);
  }
  const unread = new Set<string>();
  for (const [leadId, message] of latest) {
    if (message.direction === "inbound" && !message.read_at) unread.add(leadId);
  }
  return unread;
}
