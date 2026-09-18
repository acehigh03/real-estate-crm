"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  MessageSquare,
  Phone,
  Send,
  Timer,
} from "lucide-react";

import {
  EMPTY_ATTENTION,
  EMPTY_REVENUE_METRICS,
  type AttentionItem,
  type DashboardAttention,
  type DashboardRevenueMetrics,
} from "@/lib/dashboard-metrics";
import { fallbackAddress, leadDisplayName, messageSnippet } from "@/lib/utils";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

interface Props {
  userName: string;
  userInitials: string;
  counts: {
    totalLeads: number;
    contactedLeads: number;
    repliesReceived: number;
    hotLeads: number;
    dueToday: number;
  };
  dueLeads: Lead[];
  recentReplies: Array<{ lead: Lead; message: Message }>;
  hotLeadRows: Array<{ lead: Lead; lastMessage: Message | null }>;
  campaignPerformance: Array<{
    id: string;
    name: string;
    campaign_type: string | null;
    messaged_count: number;
    replied_count: number;
    hot_count: number;
    total_leads: number;
    conversionRate: number;
  }>;
  revenue?: DashboardRevenueMetrics;
  attention?: DashboardAttention;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Relative times depend on "now", so render a stable date until the browser has mounted.
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function Since({ iso, mounted }: { iso: string | null | undefined; mounted: boolean }) {
  if (!iso) return <>—</>;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return <>—</>;
  return <>{mounted ? formatDistanceToNowStrict(date) : format(date, "MMM d")}</>;
}

// ── Buttons: one solid emerald action per row, everything else outlined ─────
function ActionLink({
  href,
  children,
  variant = "secondary",
  icon,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  icon?: React.ReactNode;
}) {
  const primary = variant === "primary";
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3.5 text-[13px] font-medium no-underline transition hover:opacity-90"
      style={
        primary
          ? { background: "var(--g)", color: "var(--on-g)" }
          : { background: "var(--s1)", color: "var(--t1)", border: "1px solid var(--b2)" }
      }
    >
      {icon}
      {children}
    </Link>
  );
}

function CallLink({ lead, variant = "secondary" }: { lead: Lead; variant?: "primary" | "secondary" }) {
  if (!lead.phone) return null;
  return (
    <ActionLink href={`tel:${lead.phone}`} variant={variant} icon={<Phone size={13} aria-hidden />}>
      Call Lead
    </ActionLink>
  );
}

// ── Command card: a number, what it means, and where to act on it ──────────
function CommandCard({
  label,
  value,
  caption,
  action,
  href,
  icon: Icon,
  tone,
  emphasize,
  className = "",
}: {
  className?: string;
  label: string;
  value: string;
  caption: string;
  action: string;
  href: string;
  icon: React.ElementType;
  tone: string;
  emphasize?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`crm-panel group flex flex-col gap-2.5 p-4 no-underline transition hover:shadow-md ${className}`}
      style={emphasize ? { borderColor: "var(--g)", boxShadow: "0 0 0 1px var(--g)" } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium" style={{ color: "var(--t2)" }}>
          {label}
        </span>
        <Icon size={16} aria-hidden style={{ color: tone }} />
      </div>
      <div className="text-[30px] font-semibold leading-none tracking-tight" style={{ color: "var(--t1)" }}>
        {value}
      </div>
      <p className="text-[12px] leading-snug" style={{ color: "var(--t2)" }}>
        {caption}
      </p>
      <span className="inline-flex items-center gap-1 text-[12.5px] font-medium" style={{ color: "var(--g)" }}>
        {action}
        <ArrowRight size={13} aria-hidden className="transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

const REASON_STYLES = {
  reply: { bg: "var(--blud)", color: "var(--blu)" },
  overdue: { bg: "var(--redd)", color: "var(--red)" },
  offer: { bg: "var(--ambd)", color: "var(--amb)" },
} as const;

type Reason = keyof typeof REASON_STYLES;

interface AttentionRow {
  key: string;
  reason: Reason;
  reasonLabel: React.ReactNode;
  item: AttentionItem;
}

function AttentionListRow({ row, mounted }: { row: AttentionRow; mounted: boolean }) {
  const { lead, lastMessage } = row.item;
  const style = REASON_STYLES[row.reason];
  const name = leadDisplayName(lead);

  return (
    <li className="flex flex-col gap-3 px-4 py-4 xl:flex-row xl:items-center xl:justify-between" style={{ borderTop: "1px solid var(--b1)" }}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/leads/${lead.id}`} className="text-[14px] font-semibold no-underline hover:underline" style={{ color: "var(--t1)" }}>
            {name}
          </Link>
          <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: style.bg, color: style.color }}>
            {row.reasonLabel}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--t2)" }}>
          {fallbackAddress(lead.property_address)}
        </p>
        {lastMessage ? (
          <p className="mt-1.5 line-clamp-2 text-[13px]" style={{ color: "var(--t1)" }}>
            <span style={{ color: "var(--t3)" }}>{lastMessage.direction === "inbound" ? "Seller: " : "You: "}</span>
            {messageSnippet(lastMessage.body, 110)}
            <span style={{ color: "var(--t3)" }}>
              {" · "}
              <Since iso={lastMessage.created_at} mounted={mounted} />
              {mounted ? " ago" : ""}
            </span>
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {row.reason === "reply" ? (
          <>
            <ActionLink href={`/inbox?lead=${lead.id}`} variant="primary" icon={<MessageSquare size={13} aria-hidden />}>
              Draft Reply
            </ActionLink>
            <CallLink lead={lead} />
          </>
        ) : row.reason === "overdue" ? (
          <>
            <ActionLink href={`/leads/${lead.id}?tab=tasks#deal-workspace`} variant="primary" icon={<CalendarClock size={13} aria-hidden />}>
              Set Follow-up
            </ActionLink>
            <CallLink lead={lead} />
          </>
        ) : (
          <>
            <CallLink lead={lead} variant="primary" />
            <ActionLink href={`/leads/${lead.id}?tab=tasks#deal-workspace`} icon={<CalendarClock size={13} aria-hidden />}>
              Set Follow-up
            </ActionLink>
          </>
        )}
      </div>
    </li>
  );
}

function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="crm-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <h2 className="text-[14px] font-semibold" style={{ color: "var(--t1)" }}>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function DashboardClient({
  userName,
  counts,
  campaignPerformance,
  revenue = EMPTY_REVENUE_METRICS,
  attention = EMPTY_ATTENTION,
}: Props) {
  const mounted = useMounted();
  const firstName = userName.split(" ")[0] || "there";
  const { needsReplyCount, overdueCount } = attention;

  // One list, most urgent reason first; a seller appears once even if they qualify for several.
  const seen = new Set<string>();
  const rows: AttentionRow[] = [];
  const push = (items: AttentionItem[], reason: Reason, label: (item: AttentionItem) => React.ReactNode) => {
    for (const item of items) {
      if (seen.has(item.lead.id)) continue;
      seen.add(item.lead.id);
      rows.push({ key: `${reason}-${item.lead.id}`, reason, reasonLabel: label(item), item });
    }
  };
  push(attention.needsReply, "reply", () => "Replied — waiting on you");
  push(attention.overdue, "overdue", (item) => (
    <>
      Follow-up overdue <Since iso={item.lead.next_follow_up_at} mounted={mounted} />
    </>
  ));
  push(attention.awaitingOffers, "offer", () => "Offer sent — no reply yet");
  const visibleRows = rows.slice(0, 8);

  const headline =
    needsReplyCount > 0
      ? `${needsReplyCount} ${needsReplyCount === 1 ? "seller is" : "sellers are"} waiting on your reply`
      : overdueCount > 0
        ? `${overdueCount} ${overdueCount === 1 ? "follow-up is" : "follow-ups are"} overdue`
        : counts.totalLeads === 0
          ? "Add your first leads"
          : "You're all caught up";

  const firstReply = attention.needsReply[0]?.lead;
  const firstOverdue = attention.overdue[0]?.lead;
  const firstOffer = attention.awaitingOffers[0]?.lead;
  const firstHot = attention.hotNoOffer[0]?.lead;

  // Rule-based next steps built from the counts above — no invented data.
  const insights: Array<{ key: string; text: React.ReactNode; action: React.ReactNode }> = [];
  if (needsReplyCount > 0 && firstReply) {
    insights.push({
      key: "reply",
      text: (
        <>
          {needsReplyCount} {needsReplyCount === 1 ? "seller has" : "sellers have"} replied and{" "}
          {needsReplyCount === 1 ? "is" : "are"} still waiting. The longest wait is{" "}
          <strong><Since iso={attention.needsReply[0].lastMessage?.created_at} mounted={mounted} /></strong>.
        </>
      ),
      action: <ActionLink href={`/inbox?lead=${firstReply.id}`} variant="primary">Draft Reply</ActionLink>,
    });
  }
  if (overdueCount > 0 && firstOverdue) {
    insights.push({
      key: "overdue",
      text: (
        <>
          {overdueCount} {overdueCount === 1 ? "follow-up is" : "follow-ups are"} past due.
        </>
      ),
      action: <ActionLink href={`/leads/${firstOverdue.id}?tab=tasks#deal-workspace`}>Set 24hr Follow-up</ActionLink>,
    });
  }
  if (attention.awaitingOffers.length > 0 && firstOffer) {
    insights.push({
      key: "offer",
      text: <>{revenue.offersAwaitingResponse} {revenue.offersAwaitingResponse === 1 ? "offer has" : "offers have"} no response yet.</>,
      action: <CallLink lead={firstOffer} />,
    });
  }
  if (attention.hotNoOfferCount > 0 && firstHot) {
    insights.push({
      key: "hot",
      text: <>{attention.hotNoOfferCount} hot {attention.hotNoOfferCount === 1 ? "lead has" : "leads have"} no offer yet.</>,
      action: <ActionLink href={`/leads/${firstHot.id}?tab=offer#deal-workspace`}>Create Offer</ActionLink>,
    });
  }

  const stageRows = [
    ["New Leads", "New"],
    ["Contacted", "Contacted"],
    ["Replied", "Replied"],
    ["Qualified", "Qualified"],
    ["Offer Sent", "Offer sent"],
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      {/* Header: what needs you, and the one button to start */}
      <header className="order-1 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="crm-section-kicker">Hi {firstName}</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight sm:text-[26px]" style={{ color: "var(--t1)" }}>
            {headline}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionLink
            href={firstReply ? `/inbox?lead=${firstReply.id}` : "/inbox"}
            variant="primary"
            icon={<MessageSquare size={14} aria-hidden />}
          >
            {needsReplyCount > 0 ? `Reply to Leads (${needsReplyCount})` : "Open Inbox"}
          </ActionLink>
          <ActionLink href="/import">Import Leads</ActionLink>
        </div>
      </header>

      {/* Command center */}
      <div className="order-3 grid grid-cols-2 gap-3 md:order-2 md:grid-cols-3 xl:grid-cols-5">
        <CommandCard
          label="Unread replies"
          value={String(needsReplyCount)}
          caption={needsReplyCount > 0 ? "Sellers waiting on your answer" : "No one is waiting on you"}
          action="Open Inbox"
          href={firstReply ? `/inbox?lead=${firstReply.id}` : "/inbox"}
          icon={MessageSquare}
          tone="var(--g)"
          emphasize={needsReplyCount > 0}
          className="col-span-2 xl:col-span-1"
        />
        <CommandCard
          label="Overdue follow-ups"
          value={String(overdueCount)}
          caption={overdueCount > 0 ? "Past their follow-up date" : "Every follow-up is on schedule"}
          action="Set Follow-up"
          href={firstOverdue ? `/leads/${firstOverdue.id}?tab=tasks#deal-workspace` : "/leads"}
          icon={Timer}
          tone="var(--red)"
        />
        <CommandCard
          label="Deals at risk"
          value={String(revenue.dealsAtRisk)}
          caption="Sale or auction within 30 days. Not tracked yet."
          action="Review foreclosures"
          href="/foreclosures"
          icon={CalendarClock}
          tone="var(--amb)"
        />
        <CommandCard
          label="Offers awaiting response"
          value={String(revenue.offersAwaitingResponse)}
          caption="Offer sent, no reply yet"
          action={revenue.offersAwaitingResponse > 0 ? "Follow up" : "Open Pipeline"}
          href={firstOffer ? `/leads/${firstOffer.id}?tab=tasks#deal-workspace` : "/pipeline"}
          icon={Send}
          tone="var(--blu)"
        />
        <CommandCard
          label="Estimated pipeline value"
          value={money.format(revenue.pipelineValue)}
          caption="Deal values aren't tracked yet."
          action="Open Pipeline"
          href="/pipeline"
          icon={DollarSign}
          tone="var(--g)"
        />
      </div>

      <div className="order-2 grid gap-5 md:order-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Who to work, right now */}
        <Panel
          title="Needs attention now"
          right={
            rows.length > visibleRows.length ? (
              <Link href="/leads" className="text-[12.5px] font-medium no-underline" style={{ color: "var(--g)" }}>
                View all leads
              </Link>
            ) : undefined
          }
        >
          {visibleRows.length > 0 ? (
            <ul>
              {visibleRows.map((row) => (
                <AttentionListRow key={row.key} row={row} mounted={mounted} />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" style={{ borderTop: "1px solid var(--b1)" }}>
              <CheckCircle2 size={22} aria-hidden style={{ color: "var(--g)" }} />
              <p className="text-[14px] font-medium" style={{ color: "var(--t1)" }}>
                {counts.totalLeads === 0 ? "No leads yet" : "No sellers need you right now"}
              </p>
              <p className="max-w-sm text-[13px]" style={{ color: "var(--t2)" }}>
                {counts.totalLeads === 0
                  ? "Import a list of motivated sellers to start conversations."
                  : "New replies and overdue follow-ups will show up here."}
              </p>
              <ActionLink href="/import" variant="primary">
                Import Leads
              </ActionLink>
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-5">
          {insights.length > 0 ? (
            <Panel title="What to do next">
              <ul>
                {insights.map((insight) => (
                  <li key={insight.key} className="flex flex-col gap-2.5 px-4 py-3.5" style={{ borderTop: "1px solid var(--b1)" }}>
                    <p className="text-[13px] leading-snug" style={{ color: "var(--t1)" }}>
                      {insight.text}
                    </p>
                    <div>{insight.action}</div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            title="Pipeline"
            right={
              <Link href="/pipeline" className="text-[12.5px] font-medium no-underline" style={{ color: "var(--g)" }}>
                Open
              </Link>
            }
          >
            <ul>
              {stageRows.map(([stage, label]) => (
                <li key={stage} style={{ borderTop: "1px solid var(--b1)" }}>
                  <Link href="/pipeline" className="flex items-center justify-between px-4 py-2.5 text-[13px] no-underline hover:bg-[var(--s2)]" style={{ color: "var(--t1)" }}>
                    <span>{label}</span>
                    <span className="font-semibold tabular-nums">{attention.stageCounts[stage]}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Secondary: overall volume */}
            <dl className="grid grid-cols-3 gap-2 px-4 py-3 text-[12px]" style={{ borderTop: "1px solid var(--b1)", background: "var(--s2)" }}>
              <div>
                <dt style={{ color: "var(--t3)" }}>Total leads</dt>
                <dd className="mt-0.5 text-[15px] font-semibold tabular-nums" style={{ color: "var(--t1)" }}>{counts.totalLeads}</dd>
              </div>
              <div>
                <dt style={{ color: "var(--t3)" }}>Hot</dt>
                <dd className="mt-0.5 text-[15px] font-semibold tabular-nums" style={{ color: "var(--t1)" }}>{counts.hotLeads}</dd>
              </div>
              <div>
                <dt style={{ color: "var(--t3)" }}>Contacted</dt>
                <dd className="mt-0.5 text-[15px] font-semibold tabular-nums" style={{ color: "var(--t1)" }}>{counts.contactedLeads}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      {campaignPerformance.length > 0 ? (
        <div className="order-4">
        <Panel
          title="Campaigns"
          right={
            <Link href="/campaigns" className="text-[12.5px] font-medium no-underline" style={{ color: "var(--g)" }}>
              Manage
            </Link>
          }
        >
          <ul>
            {campaignPerformance.slice(0, 5).map((campaign) => (
              <li
                key={campaign.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-[13px]"
                style={{ borderTop: "1px solid var(--b1)" }}
              >
                <span className="font-medium" style={{ color: "var(--t1)" }}>{campaign.name}</span>
                <span style={{ color: "var(--t2)" }}>
                  {campaign.messaged_count} texted · {campaign.replied_count} replied · {campaign.hot_count} hot
                  {campaign.messaged_count > 0
                    ? ` · ${Math.round((campaign.replied_count / campaign.messaged_count) * 100)}% reply rate`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        </div>
      ) : null}
    </div>
  );
}
