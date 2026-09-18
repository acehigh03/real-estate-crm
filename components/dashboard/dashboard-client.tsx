"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  DollarSign,
  FileSignature,
  MessageSquare,
  Phone,
  Send,
  UserPlus,
} from "lucide-react";

import type { DashboardAttention, DashboardRevenueMetrics } from "@/lib/dashboard-metrics";
import {
  EMPTY_DASHBOARD_VIEW,
  type ActionGroup,
  type ActionItem,
  type BoardCard,
  type BoardColumn,
  type BoardStageKey,
  type ConversationRow,
  type DashboardView,
  type FlagKind,
  type Kpi,
  type Sentiment,
} from "@/lib/dashboard-view";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

interface Props {
  userName: string;
  userInitials: string;
  // Legacy aggregates, still supplied by the page; the redesigned UI renders from `view`.
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
  view?: DashboardView;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactMoney = (value: number) =>
  value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(1)}M`
    : value >= 10_000
      ? `$${Math.round(value / 1_000)}K`
      : money.format(value);

// ── Sample-data preview: links to fictional sellers must not navigate or dial ────────────
const PreviewContext = createContext(false);
const PREVIEW_HREF = "/dashboard?demo=1";

function SafeLink({
  href,
  children,
  ...rest
}: { href: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">) {
  const preview = useContext(PreviewContext);
  const isLeadSpecific = href.startsWith("tel:") || href.includes("/leads/") || href.includes("lead=");
  if (href.startsWith("tel:") && !preview) {
    return (
      <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={preview && isLeadSpecific ? PREVIEW_HREF : href} {...rest}>
      {children}
    </Link>
  );
}

// ── Time helpers: "now" only exists in the browser, so render stable text until mounted ───
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function compactAgo(iso: string | null | undefined, mounted: boolean) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  if (!mounted) return format(date, "MMM d");
  const minutes = Math.max(0, Math.round(Math.abs(Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function LocalTime({ iso, pattern }: { iso: string | null | undefined; pattern: string }) {
  if (!iso) return <>—</>;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return <>—</>;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {format(date, pattern)}
    </time>
  );
}

// ── Palette: green = action/opportunity, amber = warm, blue = contacted, purple = offers, red = urgent ──
const STAGE_STYLE: Record<BoardStageKey, { fg: string; bg: string }> = {
  new: { fg: "var(--t2)", bg: "var(--s3)" },
  skip_traced: { fg: "#0e7490", bg: "rgba(14,116,144,0.09)" },
  contacted: { fg: "var(--blu)", bg: "var(--blud)" },
  negotiating: { fg: "var(--amb)", bg: "var(--ambd)" },
  offer_sent: { fg: "var(--pur)", bg: "var(--purd)" },
  under_contract: { fg: "var(--g)", bg: "var(--gd)" },
  closed: { fg: "var(--t1)", bg: "var(--s3)" },
};

const FLAG_STYLE: Record<FlagKind, { fg: string; bg: string }> = {
  reply: { fg: "var(--g)", bg: "var(--gd)" },
  overdue: { fg: "var(--red)", bg: "var(--redd)" },
  deadline: { fg: "var(--red)", bg: "var(--redd)" },
  due: { fg: "var(--amb)", bg: "var(--ambd)" },
};

const SENTIMENT: Record<Sentiment, { label: string; fg: string; bg: string }> = {
  interested: { label: "Interested", fg: "var(--g)", bg: "var(--gd)" },
  maybe: { label: "Maybe", fg: "var(--amb)", bg: "var(--ambd)" },
  not_interested: { label: "Not interested", fg: "var(--t2)", bg: "var(--s3)" },
  review: { label: "Needs review", fg: "var(--blu)", bg: "var(--blud)" },
};

const EMPTY_COLUMN_HINT: Partial<Record<BoardStageKey, string>> = {
  skip_traced: "Skip tracing isn't connected yet",
  under_contract: "No contracts yet",
  closed: "No closed deals yet",
};

// ── Small building blocks ───────────────────────────────────────────────────────────────
function Button({
  href,
  children,
  variant = "secondary",
  size = "md",
  label,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "soft" | "secondary";
  size?: "sm" | "md";
  label?: string;
}) {
  return (
    <SafeLink
      href={href}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium no-underline transition hover:opacity-90 ${
        size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]"
      }`}
      style={
        variant === "primary"
          ? { background: "var(--g)", color: "var(--on-g)" }
          : variant === "soft"
            ? { background: "var(--gd)", color: "var(--g)", border: "1px solid var(--gb)", fontWeight: 600 }
            : { background: "var(--s1)", color: "var(--t1)", border: "1px solid var(--b2)" }
      }
    >
      {children}
    </SafeLink>
  );
}

function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`dash-card overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
        <h2 className="text-[13.5px] font-semibold tracking-tight" style={{ color: "var(--t1)" }}>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <SafeLink href={href} className="inline-flex items-center gap-1 text-[12px] font-medium no-underline" style={{ color: "var(--g)" }}>
      {children}
      <ArrowRight size={12} aria-hidden />
    </SafeLink>
  );
}

function Bars({ values, color, height = 26, label }: { values: number[]; color: string; height?: number; label: string }) {
  const max = Math.max(1, ...values);
  const width = 7;
  const gap = 3;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${values.length * (width + gap) - gap} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      {values.map((value, index) => {
        const barHeight = Math.max(value > 0 ? 2 : 1, (value / max) * height);
        const last = index === values.length - 1;
        return (
          <rect
            key={index}
            x={index * (width + gap)}
            y={height - barHeight}
            width={width}
            height={barHeight}
            rx={1.5}
            fill={color}
            opacity={value === 0 ? 0.18 : last ? 1 : 0.42}
          />
        );
      })}
    </svg>
  );
}

// ── KPI ────────────────────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  kpi,
  href,
  icon: Icon,
  tone,
  format: formatValue = (n: number) => String(n),
}: {
  label: string;
  kpi: Kpi;
  href: string;
  icon: React.ElementType;
  tone: string;
  format?: (value: number) => string;
}) {
  return (
    <SafeLink href={href} className="dash-card dash-card-lift group flex flex-col gap-2 p-3.5 no-underline">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-medium" style={{ color: "var(--t2)" }}>
          {label}
        </span>
        <Icon size={15} aria-hidden style={{ color: tone }} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[24px] font-semibold leading-none tracking-tight tabular-nums" style={{ color: "var(--t1)" }}>
          {formatValue(kpi.value)}
        </span>
        {kpi.delta !== null && kpi.delta !== 0 ? (
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: kpi.delta > 0 ? "var(--g)" : "var(--t2)" }}
            title="Change versus the previous 7 days"
          >
            {kpi.delta > 0 ? "▲" : "▼"} {Math.abs(kpi.delta)}
          </span>
        ) : null}
      </div>
      {kpi.spark ? (
        <>
          <Bars values={kpi.spark} color={tone} label={`${label}, last 14 days`} />
          <span className="truncate text-[11px]" style={{ color: "var(--t3)" }}>
            {kpi.hint}
          </span>
        </>
      ) : (
        // No history to chart: let the caption use the space instead of leaving a gap.
        <span className="text-[12px] leading-snug" style={{ color: "var(--t2)", minHeight: 26 + 16 }}>
          {kpi.hint}
        </span>
      )}
    </SafeLink>
  );
}

// ── Pipeline board ─────────────────────────────────────────────────────────────────────
function LeadCard({ card, mounted }: { card: BoardCard; mounted: boolean }) {
  const flag = card.flag ? FLAG_STYLE[card.flag.kind] : null;
  return (
    <SafeLink
      href={`/leads/${card.id}`}
      className="dash-card-lift block rounded-[10px] p-2.5 no-underline"
      style={{ background: "var(--s1)", border: "1px solid var(--b1)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-[13px] font-semibold" style={{ color: "var(--t1)" }}>
          {card.name}
        </span>
        <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: card.dealValue ? "var(--t1)" : "var(--t3)" }}>
          {card.dealValue ? compactMoney(card.dealValue) : "—"}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--t2)" }}>
        {card.address ?? "Address not found"}
      </p>
      {card.tag || flag ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {flag && card.flag ? (
            <span className="whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: flag.bg, color: flag.fg }}>
              {card.flag.label}
            </span>
          ) : null}
          {card.tag ? (
            <span className="max-w-full truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-medium" style={{ background: "var(--s3)", color: "var(--t2)" }}>
              {card.tag}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-1 text-[11px]" style={{ color: "var(--t3)" }}>
        <Clock size={11} aria-hidden />
        {card.lastContactAt ? `Last contact ${compactAgo(card.lastContactAt, mounted)}${mounted ? " ago" : ""}` : "Not contacted"}
      </div>
    </SafeLink>
  );
}

function BoardColumnView({ column, mounted }: { column: BoardColumn; mounted: boolean }) {
  const style = STAGE_STYLE[column.key];
  const hidden = column.total - column.cards.length;
  return (
    <div className="kanban-col flex flex-col gap-2" role="listitem">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold"
          style={{ background: style.bg, color: style.fg }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.fg }} aria-hidden />
          {column.label}
        </span>
        <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--t2)" }}>
          {column.total}
        </span>
      </div>
      <p className="px-0.5 text-[11px] tabular-nums" style={{ color: "var(--t3)" }}>
        {column.value > 0 ? `${compactMoney(column.value)} pipeline` : " "}
      </p>

      {column.cards.length > 0 ? (
        <>
          {column.cards.map((card) => (
            <LeadCard key={card.id} card={card} mounted={mounted} />
          ))}
          {hidden > 0 ? (
            <SafeLink href="/pipeline" className="px-1 text-[11.5px] font-medium no-underline" style={{ color: "var(--g)" }}>
              +{hidden} more
            </SafeLink>
          ) : null}
        </>
      ) : (
        <div
          className="flex h-10 items-center justify-center rounded-[10px] px-2 text-center text-[11px]"
          style={{ border: "1px dashed var(--b2)", color: "var(--t3)" }}
        >
          {EMPTY_COLUMN_HINT[column.key] ?? "No leads"}
        </div>
      )}
    </div>
  );
}

// ── Action center ──────────────────────────────────────────────────────────────────────
interface ActionSpec {
  key: string;
  title: string;
  dot: string;
  group: ActionGroup;
  viewAll: string;
  render: (item: ActionItem, mounted: boolean) => React.ReactNode;
}

function CallIcon({ item }: { item: ActionItem }) {
  if (!item.phone) return null;
  return (
    <SafeLink
      href={`tel:${item.phone}`}
      aria-label={`Call ${item.name}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg no-underline transition hover:opacity-80"
      style={{ background: "var(--s1)", color: "var(--t1)", border: "1px solid var(--b2)" }}
    >
      <Phone size={13} aria-hidden />
    </SafeLink>
  );
}

function ActionRow({
  item,
  meta,
  children,
}: {
  item: ActionItem;
  meta: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-2 px-4 py-2" style={{ borderTop: "1px solid var(--b0)" }}>
      <div className="min-w-0">
        <SafeLink href={`/leads/${item.leadId}`} className="block truncate text-[13px] font-semibold no-underline hover:underline" style={{ color: "var(--t1)" }}>
          {item.name}
        </SafeLink>
        <p className="truncate text-[11.5px]" style={{ color: "var(--t2)" }}>
          {meta}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </li>
  );
}

function ActionCenter({ view, mounted }: { view: DashboardView; mounted: boolean }) {
  const { actions } = view;
  const specs: ActionSpec[] = [
    {
      key: "overdue",
      title: "Overdue follow-ups",
      dot: "var(--red)",
      group: actions.overdue,
      viewAll: "/scheduled",
      render: (item, m) => (
        <ActionRow key={item.leadId} item={item} meta={`${compactAgo(item.at, m)}${m ? " overdue" : ""} · ${item.address ?? "No address"}`}>
          <CallIcon item={item} />
          <Button href={`/leads/${item.leadId}?tab=tasks#deal-workspace`} variant="soft" size="sm">
            Set Follow-up
          </Button>
        </ActionRow>
      ),
    },
    {
      key: "replies",
      title: "New SMS replies",
      dot: "var(--g)",
      group: actions.replies,
      viewAll: "/inbox",
      render: (item, m) => (
        <ActionRow key={item.leadId} item={item} meta={<>{item.detail} · {compactAgo(item.at, m)}{m ? " ago" : ""}</>}>
          <CallIcon item={item} />
          <Button href={`/inbox?lead=${item.leadId}`} variant="soft" size="sm">
            Draft Reply
          </Button>
        </ActionRow>
      ),
    },
    {
      key: "upcoming",
      title: "Appointments & follow-ups",
      dot: "var(--amb)",
      group: actions.upcoming,
      viewAll: "/scheduled",
      render: (item) => (
        <ActionRow key={item.leadId} item={item} meta={<LocalTime iso={item.at} pattern="EEE MMM d · h:mm a" />}>
          <CallIcon item={item} />
          <Button href={`/leads/${item.leadId}?tab=tasks#deal-workspace`} size="sm">
            Reschedule
          </Button>
        </ActionRow>
      ),
    },
    {
      key: "offers",
      title: "Offers awaiting response",
      dot: "var(--pur)",
      group: actions.offers,
      viewAll: "/pipeline",
      render: (item, m) => (
        <ActionRow key={item.leadId} item={item} meta={item.at ? `Offer sent ${compactAgo(item.at, m)}${m ? " ago" : ""}` : "Offer sent"}>
          <CallIcon item={item} />
          <Button href={`/leads/${item.leadId}?tab=tasks#deal-workspace`} size="sm">
            Follow up
          </Button>
        </ActionRow>
      ),
    },
    {
      key: "hot",
      title: "Hot leads without an offer",
      dot: "var(--g)",
      group: actions.hot,
      viewAll: "/leads",
      render: (item) => (
        <ActionRow key={item.leadId} item={item} meta={item.address ?? item.detail}>
          <CallIcon item={item} />
          <Button href={`/leads/${item.leadId}?tab=offer#deal-workspace`} size="sm">
            Create Offer
          </Button>
        </ActionRow>
      ),
    },
    {
      key: "risk",
      title: "Deadlines within 30 days",
      dot: "var(--red)",
      group: actions.atRisk,
      viewAll: "/leads",
      render: (item) => (
        <ActionRow key={item.leadId} item={item} meta={`${item.detail} · ${item.address ?? "No address"}`}>
          <CallIcon item={item} />
          <Button href={`/leads/${item.leadId}`} size="sm">
            Review deal
          </Button>
        </ActionRow>
      ),
    },
  ];
  const visible = specs.filter((spec) => spec.group.count > 0);

  return (
    <Panel
      title="Action Center"
      right={
        view.attentionCount > 0 ? (
          <span className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold tabular-nums" style={{ background: "var(--gd)", color: "var(--g)" }}>
            {view.attentionCount} to work today
          </span>
        ) : undefined
      }
    >
      {visible.length > 0 ? (
        <div className="pb-1.5">
          {visible.map((spec) => (
            <div key={spec.key} className="pt-1.5">
              <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--t2)" }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: spec.dot }} aria-hidden />
                  {spec.title} · {spec.group.count}
                </span>
                {spec.group.count > 3 ? <PanelLink href={spec.viewAll}>All</PanelLink> : null}
              </div>
              <ul className="action-list">{spec.group.items.slice(0, 3).map((item) => spec.render(item, mounted))}</ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pb-4 pt-1" style={{ borderTop: "1px solid var(--b0)" }}>
          <p className="inline-flex items-center gap-2 pt-3 text-[13px] font-medium" style={{ color: "var(--t1)" }}>
            <CheckCircle2 size={16} aria-hidden style={{ color: "var(--g)" }} />
            {view.totals.leads === 0 ? "Nothing to work yet" : "You're all caught up"}
          </p>
          <div className="flex flex-wrap gap-2">
            {view.totals.leads === 0 ? (
              <>
                <Button href="/import" variant="primary" size="sm">
                  Import leads
                </Button>
                <Button href="/inbox?new=1" size="sm">
                  <MessageSquare size={13} aria-hidden />
                  Text a seller
                </Button>
              </>
            ) : (
              <>
                <Button href="/inbox?new=1" variant="primary" size="sm">
                  <MessageSquare size={13} aria-hidden />
                  Text a seller
                </Button>
                <Button href="/import" size="sm">
                  Import leads
                </Button>
                <Button href="/scheduled" size="sm">
                  Schedule a follow-up
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ── Conversations, activity, performance ───────────────────────────────────────────────
function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function ConversationsPanel({ rows, mounted }: { rows: ConversationRow[]; mounted: boolean }) {
  return (
    <Panel title="Recent conversations" right={<PanelLink href="/inbox">Open Inbox</PanelLink>}>
      {rows.length > 0 ? (
        <ul>
          {rows.map((row) => {
            const sentiment = row.sentiment ? SENTIMENT[row.sentiment] : null;
            return (
              <li key={row.leadId} style={{ borderTop: "1px solid var(--b0)" }}>
                <SafeLink href={`/inbox?lead=${row.leadId}`} className="flex items-center gap-3 px-4 py-2.5 no-underline transition hover:bg-[var(--s2)]">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                    style={{ background: sentiment?.bg ?? "var(--s3)", color: "var(--t1)" }}
                  >
                    {initialsOf(row.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold" style={{ color: "var(--t1)" }}>
                        {row.name}
                      </span>
                      {row.unread ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--g)" }} aria-label="Unread" /> : null}
                    </div>
                    <p className="truncate text-[12px]" style={{ color: "var(--t2)" }}>
                      {row.direction === "outbound" ? <span style={{ color: "var(--t3)" }}>You: </span> : null}
                      {row.snippet}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] tabular-nums" style={{ color: "var(--t3)" }}>
                      {compactAgo(row.at, mounted)}
                    </span>
                    {sentiment ? (
                      <span className="whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: sentiment.bg, color: sentiment.fg }}>
                        {sentiment.label}
                      </span>
                    ) : null}
                  </div>
                </SafeLink>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-1" style={{ borderTop: "1px solid var(--b0)" }}>
          <p className="pt-3 text-[13px]" style={{ color: "var(--t2)" }}>
            No conversations yet.
          </p>
          <div className="pt-3">
            <Button href="/inbox?new=1" variant="primary" size="sm">
              Start a conversation
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

const ACTIVITY_STYLE = {
  reply: { icon: MessageSquare, fg: "var(--g)", bg: "var(--gd)" },
  text: { icon: Send, fg: "var(--blu)", bg: "var(--blud)" },
  lead: { icon: UserPlus, fg: "var(--t2)", bg: "var(--s3)" },
} as const;

function ActivityPanel({ view, mounted }: { view: DashboardView; mounted: boolean }) {
  // Events arrive for the last 48h; "today" means since the viewer's local midnight.
  const events = useMemo(() => {
    if (!mounted) return view.activity.slice(0, 8);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return view.activity.filter((event) => new Date(event.at) >= midnight).slice(0, 8);
  }, [view.activity, mounted]);

  return (
    <Panel
      title="Today's activity"
      right={
        <span className="text-[11.5px]" style={{ color: "var(--t3)" }}>
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      }
    >
      {events.length > 0 ? (
        <ol className="px-4 pb-3 pt-1" style={{ borderTop: "1px solid var(--b0)" }}>
          {events.map((event, index) => {
            const style = ACTIVITY_STYLE[event.kind];
            const Icon = style.icon;
            return (
              <li key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: style.bg, color: style.fg }}>
                    <Icon size={12} aria-hidden />
                  </span>
                  {index < events.length - 1 ? <span className="mt-1 w-px flex-1" style={{ background: "var(--b1)" }} aria-hidden /> : null}
                </div>
                <div className="min-w-0 flex-1 pb-2.5 pt-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-medium" style={{ color: "var(--t1)" }}>
                      {event.title}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--t3)" }}>
                      <LocalTime iso={event.at} pattern="h:mm a" />
                    </span>
                  </div>
                  {event.detail ? (
                    <p className="truncate text-[11.5px]" style={{ color: "var(--t2)" }}>
                      {event.detail}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-1" style={{ borderTop: "1px solid var(--b0)" }}>
          <p className="pt-3 text-[13px]" style={{ color: "var(--t2)" }}>
            Nothing yet today.
          </p>
          <div className="pt-3">
            <Button href="/inbox?new=1" size="sm">
              Text a seller
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function PerformancePanel({ view }: { view: DashboardView }) {
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const rows = [
    { label: "Leads contacted", total: sum(view.series.contacted), series: view.series.contacted, color: "var(--blu)" },
    { label: "Replies", total: sum(view.series.replies), series: view.series.replies, color: "var(--g)" },
  ];
  return (
    <Panel
      title="Performance"
      right={
        <span className="text-[11.5px]" style={{ color: "var(--t3)" }}>
          Last 14 days
        </span>
      }
    >
      <div style={{ borderTop: "1px solid var(--b0)" }}>
        {rows.map((row) => (
          <div key={row.label} className="px-4 py-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-medium" style={{ color: "var(--t2)" }}>
                {row.label}
              </span>
              <span className="text-[16px] font-semibold tabular-nums" style={{ color: "var(--t1)" }}>
                {row.total}
              </span>
            </div>
            <div className="mt-1.5">
              <Bars values={row.series} color={row.color} height={30} label={`${row.label}, last 14 days`} />
            </div>
          </div>
        ))}
        <dl className="grid grid-cols-3 gap-2 px-4 py-3 text-[11px]" style={{ borderTop: "1px solid var(--b0)", background: "var(--s2)" }}>
          <div>
            <dt style={{ color: "var(--t3)" }}>Offers sent</dt>
            <dd className="mt-0.5 text-[14px] font-semibold tabular-nums" style={{ color: "var(--pur)" }}>
              {view.kpis.offersSent.value}
            </dd>
          </div>
          <div>
            <dt style={{ color: "var(--t3)" }}>Contracts</dt>
            <dd className="mt-0.5 text-[14px] font-semibold tabular-nums" style={{ color: "var(--g)" }}>
              {view.kpis.contracts.value}
            </dd>
          </div>
          <div>
            <dt style={{ color: "var(--t3)" }}>Pipeline</dt>
            <dd className="mt-0.5 text-[14px] font-semibold tabular-nums" style={{ color: "var(--t1)" }}>
              {compactMoney(view.kpis.pipelineValue.value)}
            </dd>
          </div>
        </dl>
        <p className="px-4 pb-3 text-[11px]" style={{ color: "var(--t3)" }}>
          {view.totals.leads} total leads · {view.totals.hot} hot · {view.totals.contacted} contacted
        </p>
      </div>
    </Panel>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────────────
function greetingFor(hour: number) {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function DashboardClient({ userName, campaignPerformance, view = EMPTY_DASHBOARD_VIEW }: Props) {
  const mounted = useMounted();
  const firstName = userName.split(" ")[0] || "there";
  const greeting = mounted ? greetingFor(new Date().getHours()) : "Welcome back";
  const unread = view.kpis.unreadReplies.value;
  const empty = view.totals.leads === 0 && !view.sample;

  return (
    <PreviewContext.Provider value={view.sample}>
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-3.5 px-4 py-4 sm:px-6 sm:py-5 xl:grid xl:grid-cols-12 xl:items-start xl:gap-4">
        {view.sample ? (
          <div
            className="order-1 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-[12.5px] xl:col-span-12"
            style={{ background: "var(--ambd)", border: "1px solid var(--ambb)", color: "var(--t1)" }}
            role="status"
          >
            <span>
              <strong>Sample data preview.</strong> Fictional sellers; nothing is saved.
              <span className="hidden sm:inline"> Links to sample sellers are turned off.</span>
            </span>
            <Link href="/dashboard" className="font-semibold no-underline" style={{ color: "var(--g)" }}>
              Exit preview
            </Link>
          </div>
        ) : null}

        {/* Header */}
        <header className="order-1 flex flex-wrap items-end justify-between gap-3 xl:col-span-12">
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold leading-tight tracking-tight sm:text-[22px]" style={{ color: "var(--t1)" }} suppressHydrationWarning>
              {greeting}, {firstName}
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--t2)" }}>
              {view.attentionCount > 0
                ? `You have ${view.attentionCount} ${view.attentionCount === 1 ? "lead" : "leads"} needing attention today.`
                : empty
                  ? "Import your first leads to get started."
                  : "You're all caught up — no leads need attention today."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href="/import">Import Leads</Button>
            <Button href="/inbox" variant="primary">
              <MessageSquare size={14} aria-hidden />
              Open Inbox{unread > 0 ? ` (${unread})` : ""}
            </Button>
          </div>
        </header>

        {/* Onboarding — only for an account with no leads at all */}
        {empty ? (
          <div className="dash-card order-2 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 xl:col-span-12">
            <span className="text-[13px] font-semibold" style={{ color: "var(--t1)" }}>
              Get started
            </span>
            <ol className="flex flex-1 flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
              {[
                ["1", "Import your leads", "/import"],
                ["2", "Text your first seller", "/inbox?new=1"],
                ["3", "Schedule a follow-up", "/scheduled"],
              ].map(([step, label, href]) => (
                <li key={step}>
                  <Link href={href} className="inline-flex items-center gap-2 no-underline" style={{ color: "var(--t1)" }}>
                    <span className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-semibold" style={{ background: "var(--gd)", color: "var(--g)" }}>
                      {step}
                    </span>
                    {label}
                  </Link>
                </li>
              ))}
            </ol>
            <Link href="/dashboard?demo=1" className="text-[12.5px] font-medium no-underline" style={{ color: "var(--g)" }}>
              See a sample dashboard
            </Link>
          </div>
        ) : null}

        {/* Action Center — first thing to read on a phone, right rail on desktop */}
        <div className="order-3 md:order-4 xl:order-5 xl:col-span-4">
          <ActionCenter view={view} mounted={mounted} />
        </div>

        {/* KPIs */}
        <div className="order-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:order-3 xl:order-3 xl:col-span-12 xl:grid-cols-6">
          <KpiCard label="New leads" kpi={view.kpis.newLeads} href="/leads" icon={UserPlus} tone="var(--t2)" />
          <KpiCard label="Unread replies" kpi={view.kpis.unreadReplies} href="/inbox" icon={MessageSquare} tone="var(--g)" />
          <KpiCard label="Follow-ups due" kpi={view.kpis.followUpsDue} href="/scheduled" icon={CalendarClock} tone="var(--amb)" />
          <KpiCard label="Offers sent" kpi={view.kpis.offersSent} href="/pipeline" icon={Send} tone="var(--pur)" />
          <KpiCard label="Contracts" kpi={view.kpis.contracts} href="/pipeline" icon={FileSignature} tone="var(--g)" />
          <KpiCard label="Pipeline value" kpi={view.kpis.pipelineValue} href="/pipeline" icon={DollarSign} tone="var(--t1)" format={compactMoney} />
        </div>

        {/* Pipeline board */}
        <div className="order-5 xl:order-4 xl:col-span-8">
          <Panel title="Pipeline" right={<PanelLink href="/pipeline">Open full board</PanelLink>}>
            <div className="px-4 pb-4 pt-1" style={{ borderTop: "1px solid var(--b0)" }}>
              <div className="kanban pt-3" role="list" aria-label="Pipeline stages">
                {view.board.map((column) => (
                  <BoardColumnView key={column.key} column={column} mounted={mounted} />
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* Conversations · Activity · Performance */}
        <div className="order-6 xl:col-span-5">
          <ConversationsPanel rows={view.conversations} mounted={mounted} />
        </div>
        <div className="order-7 xl:col-span-4">
          <ActivityPanel view={view} mounted={mounted} />
        </div>
        <div className="order-8 xl:col-span-3">
          <PerformancePanel view={view} />
        </div>

        {campaignPerformance.length > 0 ? (
          <div className="order-9 xl:col-span-12">
            <Panel title="Campaigns" right={<PanelLink href="/campaigns">Manage</PanelLink>}>
              <ul>
                {campaignPerformance.slice(0, 5).map((campaign) => (
                  <li
                    key={campaign.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]"
                    style={{ borderTop: "1px solid var(--b0)" }}
                  >
                    <span className="font-medium" style={{ color: "var(--t1)" }}>
                      {campaign.name}
                    </span>
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
    </PreviewContext.Provider>
  );
}
