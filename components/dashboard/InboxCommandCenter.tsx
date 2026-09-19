"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bell, Check, ChevronRight, Clock3, DollarSign, FileText, Home, MessageCircle, MessageSquare, Phone, Search, Users, CircleAlert } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { initialsOf, leadFullName } from "@/lib/board";
import { formatMoneyCompact, formatShort } from "@/lib/format";
import { useTheme } from "@/lib/theme-context";
import { TodayActivity } from "./TodayActivity";

/** A presentation of the existing dashboard payload; no requests or mutations. */
export function InboxCommandCenter({ data, greeting, userName, isDemo, children }: {
  data: DashboardData; greeting: string; userName: string; isDemo: boolean; children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<"needs" | "all">("needs");
  if (theme === "dark") return children;

  const leads = new Map(data.board.flatMap(column => column.leads).map(lead => [lead.id, lead]));
  const followUps = new Map(data.atRisk.deals.filter(deal => deal.reason === "overdue_followup").map(deal => [deal.id, deal]));
  // Surface loaded overdue leads even when they are outside the recent-message window.
  // The detail remains a follow-up notice, never a fabricated seller message.
  const additionalFollowUps = [...followUps.values()].filter(deal => !data.conversations.some(item => item.lead_id === deal.id)).map(deal => {
    const lead = leads.get(deal.id);
    return { lead_id: deal.id, name: deal.name, phone: lead?.phone ?? "", preview: deal.detail,
      at: lead?.next_follow_up_at ?? "", unread: false, direction: "inbound" as const };
  });
  const attentionCount = data.unreadReplies + [...followUps.keys()].filter(id => !data.conversations.some(item => item.lead_id === id && item.unread)).length;
  const conversations = [...data.conversations, ...additionalFollowUps].sort((a, b) => {
    const priority = (item: typeof a) => Number(item.unread) * 4 + Number(item.direction === "inbound") * 2 + Number(followUps.has(item.lead_id));
    return priority(b) - priority(a) || Date.parse(b.at) - Date.parse(a.at);
  });
  const rows = conversations.filter(item => filter === "all" || item.unread || item.direction === "inbound" || followUps.has(item.lead_id));
  const metrics = [
    { label: "Leads contacted", value: data.stats.contacted.toLocaleString("en-US"), icon: Users, tone: "violet" },
    { label: "Replies", value: data.stats.replies.toLocaleString("en-US"), icon: MessageCircle, tone: "blue" },
    { label: "Offers sent", value: data.stats.offersSent.toLocaleString("en-US"), icon: FileText, tone: "violet" },
    { label: "Pipeline value", value: formatMoneyCompact(data.stats.pipelineValue), icon: DollarSign, tone: "green" },
  ];

  return (
    <div className="inbox-dashboard">
      <div className="command-content">
        <header className="command-header">
          <div className="command-topline">
            <p className="command-eyebrow">Real estate · SMS wholesaling · Bigger tomorrows</p>
            <div className="command-tools">
              <div className="command-search"><Search size={16} aria-hidden /><input aria-label="Search preview (unavailable)" placeholder="Search contacts, addresses, or messages..." disabled /></div>
              <Link href="/messenger" className="command-bell" aria-label={`Open messenger: ${data.unreadReplies} unread replies`}><Bell size={19} aria-hidden />{data.unreadReplies > 0 && <i />}</Link>
            </div>
          </div>
          <h1>{greeting}, {userName}</h1>
          <p className="command-subtitle">{isDemo ? "Sample data — nothing here is real or saved." : "Here’s what needs you today."}</p>
          <nav className="command-priorities" aria-label="Today's priorities">
            <Link href="/messenger"><span className="command-bubble violet"><MessageSquare size={19} /></span><span><strong>{data.unreadReplies}</strong> {data.unreadReplies === 1 ? "reply" : "replies"} waiting</span></Link>
            <Link href="/pipeline"><span className="command-bubble rose"><CircleAlert size={21} /></span><span><strong>{data.atRisk.overdueFollowUps}</strong> overdue {data.atRisk.overdueFollowUps === 1 ? "follow-up" : "follow-ups"}</span></Link>
            <Link href="/pipeline"><span className="command-bubble green"><Check size={21} /></span><span><strong>{data.atRisk.staleOffers}</strong> stalled {data.atRisk.staleOffers === 1 ? "offer" : "offers"}</span></Link>
          </nav>
          <span className="command-motto" aria-hidden>More deals.<br />Brighter tomorrows.</span>
        </header>

        <div className="command-grid">
          <div className="command-primary">
            <section className="command-card command-queue" aria-label="Action queue">
              <div className="command-panel-heading"><h2>Action queue <span className="command-count">{attentionCount} need you</span></h2><Link href="/messenger" aria-label="Open all conversations" className="command-icon-link"><ArrowRight size={18} /></Link></div>
              <nav className="command-tabs" aria-label="Queue views">
                <button type="button" aria-pressed={filter === "needs"} onClick={() => setFilter("needs")}>Needs reply <span>{data.unreadReplies}</span></button>
                <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All activity</button>
                <Link href="/scheduled">Scheduled</Link>
              </nav>
              <div className="command-rows">
                {rows.map(conversation => {
                  const lead = leads.get(conversation.lead_id);
                  const followUp = followUps.get(conversation.lead_id);
                  const address = lead?.property_address || followUp?.address;
                  const status = followUp ? "Follow up" : lead?.stage || lead?.status;
                  return <article className="command-row" key={conversation.lead_id}>
                    <span className="command-avatar" aria-hidden>{initialsOf(conversation.name)}</span>
                    <div className="command-identity"><Link href={`/leads/${conversation.lead_id}`}>{conversation.name}</Link>{address ? <p><Home size={13} aria-hidden /><span>{address}</span></p> : <p>{conversation.phone}</p>}</div>
                    <p className="command-message">{conversation.direction === "outbound" ? "You: " : ""}{conversation.preview}</p>
                    <div className="command-status">{status ? <span className={followUp ? "follow-up" : ""}>{followUp && <Clock3 size={12} aria-hidden />}{status}</span> : conversation.unread ? <span>Unread</span> : null}</div>
                    {conversation.at ? <time className="command-time" dateTime={conversation.at}>{formatShort(conversation.at)}</time> : <span className="command-time" />}
                    <div className="command-row-actions"><Link className="command-reply" href={`/messenger?lead=${conversation.lead_id}`}><MessageCircle size={15} aria-hidden />Reply</Link>{conversation.phone && <a className="command-call" href={`tel:${conversation.phone}`} aria-label={`Call ${conversation.name}`}><Phone size={14} aria-hidden />Call</a>}</div>
                  </article>;
                })}
                {rows.length === 0 && <div className="command-empty"><span className="command-bubble violet"><MessageSquare size={26} /></span><h3>{data.conversations.length ? "No replies waiting" : "No conversations yet."}</h3><p>{data.conversations.length ? "Your recent conversations are in All activity." : "Replies from sellers show up here."}</p>{data.conversations.length > 0 && <button type="button" onClick={() => setFilter("all")}>View all activity <ArrowRight size={15} /></button>}</div>}
              </div>
            </section>
            <section className="command-metrics" aria-label="Dashboard metrics">{metrics.map(({ label, value, icon: Icon, tone }) => <div className="command-card command-metric" key={label}><span className={`command-bubble ${tone}`}><Icon size={23} /></span><div><p>{label}</p><strong>{value}</strong></div></div>)}</section>
            <details className="command-today"><summary>Today’s activity <span>{data.today.textsSent} texts sent · {data.today.repliesReceived} replies received</span></summary><TodayActivity activity={data.today} /></details>
          </div>

          <section className="command-card command-pipeline" aria-label="Pipeline summary">
            <div className="command-panel-heading"><h2>Pipeline</h2><Link href="/pipeline">Open full board <ArrowRight size={14} aria-hidden /></Link></div>
            <div className="command-stages">{data.board.map(column => {
              const lead = column.leads[0];
              return <section className={`command-stage stage-${column.key}`} key={column.key} aria-label={`${column.label}: ${column.count}`}>
                <h3><i /><span>{column.label}</span><b>{column.count}</b></h3>
                <div className="command-stage-body">{lead ? <><Link href={`/leads/${lead.id}`} className="command-lead"><span className="command-avatar">{initialsOf(leadFullName(lead))}</span><span><strong>{leadFullName(lead)}</strong>{lead.property_address && <small>{lead.property_address}</small>}</span><ChevronRight size={16} aria-hidden /></Link>{column.count > 1 && <Link href="/pipeline" className="command-more">+ {column.count - 1} more {column.count === 2 ? "lead" : "leads"}</Link>}</> : column.emptyHref ? <Link className="command-stage-empty" href={column.emptyHref}>{column.emptyText}</Link> : <p className="command-stage-empty">{column.emptyText}</p>}</div>
              </section>;
            })}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
