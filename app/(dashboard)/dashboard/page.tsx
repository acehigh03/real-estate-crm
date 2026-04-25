import { format } from "date-fns";

import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage() {
  const { leads, stats, followups } = await getDashboardData();
  const recentLeads = leads.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Overview</p>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard home</h1>
        <p className="text-sm text-muted">Track seller lead activity, inbound replies, and follow-ups due today.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total leads" value={stats.total} hint="All imported or manually created leads" />
        <StatCard label="Contacted" value={stats.contacted} hint="Leads with outreach already sent" />
        <StatCard label="Replies" value={stats.replied} hint="Inbound messages matched to a lead" />
        <StatCard label="Hot leads" value={stats.hot} hint="High-priority sellers worth fast follow-up" />
        <StatCard label="Due today" value={stats.followUpsToday} hint="Follow-ups requiring attention today" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold">Recent leads</h2>
          <div className="mt-5 space-y-3">
            {recentLeads.length ? (
              recentLeads.map((lead) => (
                <div key={lead.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-border px-4 py-4 md:flex-row md:items-center">
                  <div>
                    <p className="font-medium">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-sm text-muted">{lead.property_address}</p>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>{lead.status}</p>
                    <p>{lead.phone}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No leads yet. Upload a CSV on the Leads page to get started.</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold">Follow-ups due today</h2>
          <div className="mt-5 space-y-3">
            {followups.length ? (
              followups.map((followup) => (
                <div key={followup.id} className="rounded-2xl border border-border px-4 py-4">
                  <p className="font-medium">{format(new Date(followup.due_date), "PPP")}</p>
                  <p className="text-sm text-muted">{followup.note ?? "No follow-up note"}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">Nothing due today.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
