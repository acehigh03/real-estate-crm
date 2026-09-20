import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  MessageCircle,
  Phone,
  Send,
  Users,
} from "lucide-react";

import type { getDashboardStats } from "@/lib/data";
import type { ActionItem } from "@/lib/dashboard-view";
import { formatMoneyCompact, formatShort } from "@/lib/format";

type DashboardData = Awaited<ReturnType<typeof getDashboardStats>>;

function total(value: number | null | undefined) {
  return Number(value ?? 0);
}

function actionRows(data: DashboardData) {
  const groups: Array<{ kind: "reply" | "overdue" | "scheduled"; items: ActionItem[] }> = [
    { kind: "reply", items: data.view.actions.replies.items },
    { kind: "overdue", items: data.view.actions.overdue.items },
    { kind: "scheduled", items: data.view.actions.upcoming.items },
  ];
  const seen = new Set<string>();
  return groups.flatMap(({ kind, items }) => items.map((item) => ({ ...item, kind })))
    .filter((item) => (seen.has(item.leadId) ? false : (seen.add(item.leadId), true)))
    .slice(0, 4);
}

export function DashboardOverview({ data, userName }: { data: DashboardData; userName: string }) {
  const { view } = data;
  const actions = actionRows(data);
  const campaigns = data.campaignPerformance;
  const campaignTotals = campaigns.reduce(
    (sum, campaign) => ({
      sent: sum.sent + total(campaign.messaged_count),
      replies: sum.replies + total(campaign.replied_count),
      hot: sum.hot + total(campaign.hot_count),
    }),
    { sent: 0, replies: 0, hot: 0 }
  );
  const week = {
    texts: view.series.contacted.slice(-7).reduce((sum, value) => sum + value, 0),
    replies: view.series.replies.slice(-7).reduce((sum, value) => sum + value, 0),
    leads: view.series.newLeads.slice(-7).reduce((sum, value) => sum + value, 0),
    followUps: data.counts.dueToday,
  };
  const kpis = [
    { label: "Replies waiting", value: view.kpis.unreadReplies.value, hint: view.kpis.unreadReplies.hint, icon: MessageCircle, tone: "blue", href: "/inbox" },
    { label: "Follow-ups due", value: view.kpis.followUpsDue.value, hint: view.kpis.followUpsDue.hint, icon: CalendarClock, tone: "amber", href: "/scheduled" },
    { label: "Offers sent", value: view.kpis.offersSent.value, hint: view.kpis.offersSent.hint, icon: Send, tone: "purple", href: "/pipeline" },
    { label: "Active pipeline", value: formatMoneyCompact(view.kpis.pipelineValue.value), hint: view.kpis.pipelineValue.hint, icon: CircleDollarSign, tone: "green", href: "/pipeline" },
  ];

  return (
    <div className="owner-dashboard">
      <header className="owner-dashboard__header">
        <div>
          <p className="owner-dashboard__eyebrow">Owner dashboard</p>
          <h1>Good afternoon, {userName}</h1>
          <p>Your business at a glance. Inbox stays your command center.</p>
        </div>
        <div className="owner-dashboard__header-actions">
          <Link href="/inbox" className="owner-button owner-button--secondary">Open Inbox <ArrowRight size={16} /></Link>
          <Link href="/inbox?new=1" className="owner-button">Start conversation</Link>
        </div>
      </header>

      <section className="owner-kpis" aria-label="Today at a glance">
        {kpis.map(({ label, value, hint, icon: Icon, tone, href }) => (
          <Link key={label} href={href} className={`owner-kpi owner-kpi--${tone}`}>
            <span className="owner-kpi__icon"><Icon size={20} /></span>
            <span><strong>{value}</strong><b>{label}</b><small>{hint}</small></span>
            <ChevronRight size={18} aria-hidden />
          </Link>
        ))}
      </section>

      <section className="owner-dashboard__grid">
        <article className="owner-card owner-card--actions">
          <div className="owner-card__heading">
            <div><p className="owner-card__eyebrow">Focus</p><h2>Today’s action plan</h2><span>{view.attentionCount} seller{view.attentionCount === 1 ? "" : "s"} need attention</span></div>
            <Link href="/inbox">View Inbox <ArrowRight size={15} /></Link>
          </div>
          <div className="owner-actions">
            {actions.map((item) => (
              <div className="owner-action" key={item.leadId}>
                <span className={`owner-action__signal owner-action__signal--${item.kind}`} />
                <div className="owner-action__person"><strong>{item.name}</strong><span>{item.address || item.phone || "Lead details need completing"}</span></div>
                <div className="owner-action__reason"><b>{item.kind === "reply" ? "Needs reply" : item.kind === "overdue" ? "Follow-up overdue" : "Follow-up scheduled"}</b><span>{item.at ? formatShort(item.at) : item.detail}</span></div>
                <div className="owner-action__buttons"><Link href={`/inbox?lead=${item.leadId}`}>Open inbox</Link>{item.phone ? <a href={`tel:${item.phone}`} aria-label={`Call ${item.name}`}><Phone size={15} />Call</a> : null}</div>
              </div>
            ))}
            {!actions.length && <div className="owner-empty"><CheckCircle2 size={21} /><div><strong>Nothing urgent right now</strong><span>New seller replies and follow-ups will appear here.</span></div><Link href="/inbox">Open Inbox</Link></div>}
          </div>
        </article>

        <article className="owner-card owner-card--pipeline">
          <div className="owner-card__heading"><div><p className="owner-card__eyebrow">Deals</p><h2>Pipeline pulse</h2><span>Active deals by stage</span></div><Link href="/pipeline">Open pipeline <ArrowRight size={15} /></Link></div>
          <div className="owner-pipeline">
            {view.board.filter((stage) => stage.total > 0).slice(0, 5).map((stage) => (
              <Link href="/pipeline" key={stage.key} className="owner-pipeline__row"><span><i className={`owner-pipeline__dot owner-pipeline__dot--${stage.key}`} />{stage.label}</span><b>{stage.total}</b><em>{formatMoneyCompact(stage.value)}</em></Link>
            ))}
            {!view.board.some((stage) => stage.total > 0) && <div className="owner-pipeline__empty"><Users size={20} />No active deals yet</div>}
          </div>
        </article>
      </section>

      <section className="owner-dashboard__lower">
        <article className="owner-card owner-card--campaigns">
          <div className="owner-card__heading"><div><p className="owner-card__eyebrow">Outreach</p><h2>Campaign health</h2><span>Real results across your campaigns</span></div><Link href="/campaigns">View campaigns <ArrowRight size={15} /></Link></div>
          {campaigns.length ? <><div className="owner-campaign-metrics"><div><strong>{campaignTotals.sent.toLocaleString()}</strong><span>Sent</span></div><div><strong>{campaignTotals.replies.toLocaleString()}</strong><span>Replies</span></div><div><strong>{campaignTotals.hot.toLocaleString()}</strong><span>Hot leads</span></div><div><strong>{campaignTotals.sent ? `${Math.round((campaignTotals.replies / campaignTotals.sent) * 1000) / 10}%` : "0%"}</strong><span>Reply rate</span></div></div><div className="owner-campaign-list">{campaigns.slice(0, 3).map((campaign) => <Link href="/campaigns" key={campaign.id}><span>{campaign.name}</span><em>{total(campaign.messaged_count).toLocaleString()} sent</em><b>{total(campaign.replied_count)} replies</b></Link>)}</div></> : <div className="owner-empty"><Send size={21} /><div><strong>No campaign activity yet</strong><span>Create a campaign when your next list is ready.</span></div><Link href="/campaigns">Create campaign</Link></div>}
        </article>

        <article className="owner-card owner-card--week">
          <div className="owner-card__heading"><div><p className="owner-card__eyebrow">Momentum</p><h2>This week</h2><span>Live activity from your CRM</span></div><BarChart3 size={20} /></div>
          <div className="owner-week-grid"><div><MessageCircle /><strong>{week.replies}</strong><span>Replies received</span></div><div><Send /><strong>{week.texts}</strong><span>Leads contacted</span></div><div><Users /><strong>{week.leads}</strong><span>New leads</span></div><div><CalendarClock /><strong>{week.followUps}</strong><span>Due today</span></div></div>
        </article>
      </section>
    </div>
  );
}
