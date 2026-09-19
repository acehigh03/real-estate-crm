"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";

import type { ConversationPreview } from "@/lib/dashboard";
import { initialsOf } from "@/lib/board";
import { formatPhone, formatShort } from "@/lib/format";
import { IconChip } from "./IconChip";

export function InboxPreview({ conversations }: { conversations: ConversationPreview[] }) {
  return (
    <section aria-label="Inbox" className="c-card overflow-hidden">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <h2 className="flex items-center gap-2.5 text-[16px] font-bold text-[var(--c-text)]"><IconChip icon={Inbox} tone="accent" size={34} shape="square" />Inbox</h2>
        <Link href="/messenger" className="text-[13px] font-medium text-[var(--c-accent-strong)] hover:underline">View all</Link>
      </div>
      {conversations.length === 0 ? (
        <p className="px-4 pb-5 pt-2 text-[13px] text-[var(--c-muted)]">No conversations yet. Replies from sellers show up here.</p>
      ) : (
        <ul className="divide-y divide-[var(--c-border)]">
          {conversations.map((conversation) => (
            <li key={conversation.lead_id}>
              <Link href={`/messenger?lead=${conversation.lead_id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--c-surface-2)]">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--c-accent-soft)] text-[12px] font-semibold text-[var(--c-accent-strong)]">{initialsOf(conversation.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-[13.5px] ${conversation.unread ? "font-semibold text-[var(--c-text)]" : "font-medium text-[var(--c-text-2)]"}`}>{conversation.name}</span>
                    <span className="num shrink-0 text-[11px] text-[var(--c-muted)]">{formatShort(conversation.at)}</span>
                  </span>
                  <span className="num block text-[11px] text-[var(--c-muted)]">{formatPhone(conversation.phone)}</span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-[12.5px] text-[var(--c-text-2)]">{conversation.direction === "outbound" ? "You: " : ""}{conversation.preview}</span>
                    {conversation.unread && <span aria-label="Unread" className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[var(--c-rose)]" />}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
