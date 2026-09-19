import "@/styles/inbox-dashboard.css";
import { InboxCommandCenter } from "@/components/dashboard/InboxCommandCenter";
import { redirect } from "next/navigation";

import { InboxPreview } from "@/components/dashboard/InboxPreview";
import { PipelineBoard } from "@/components/dashboard/PipelineBoard";
import { PrioritiesBar } from "@/components/dashboard/PrioritiesBar";
import { SignalCards } from "@/components/dashboard/SignalCards";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { TodayActivity } from "@/components/dashboard/TodayActivity";
import { getDashboardData } from "@/lib/dashboard";
import { makeDemoDashboard } from "@/lib/dashboard-demo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function greeting() {
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // "senay24@gmail.com" -> "Senay"
  const namePart = (user.email?.split("@")[0] ?? "").replace(/\d+/g, "");
  const userName = namePart.split(/[._-]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || "there";

  // ?demo=1 previews the layout with fictional data, built in memory for this request only.
  const isDemo = demo === "1";
  const data = isDemo ? makeDemoDashboard() : await getDashboardData();
  const negotiating = data.board.find((column) => column.key === "negotiating");

  return (
    <InboxCommandCenter data={data} greeting={greeting()} userName={userName} isDemo={isDemo}>
    <div className="relative flex-1 overflow-y-auto overflow-x-hidden bg-[var(--c-page)]">
      <div className="relative mx-auto max-w-[1400px] space-y-7 px-4 py-7 sm:px-8">
        <div className="dash-header -mx-4 -mt-7 space-y-5 px-4 pb-1 pt-7 sm:-mx-8 sm:px-8">
        <header>
          <h1 className="h-display text-[28px] sm:text-[30px]">{greeting()}, {userName}</h1>
          <p className="mt-1.5 text-[14px] font-medium text-[var(--c-muted)]">
            {isDemo ? "Sample data — nothing here is real or saved." : "Here’s what needs you today."}
          </p>
        </header>

        <PrioritiesBar unreadReplies={data.unreadReplies} overdueFollowUps={data.atRisk.overdueFollowUps} stalledOffers={data.atRisk.staleOffers} />
        </div>

        <div className="relative grid grid-cols-1 gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <div className="min-w-0 space-y-6">
            <SignalCards
              unreadReplies={data.unreadReplies}
              newLeads={data.newLeads}
              atRiskCount={data.atRisk.count}
              atRiskValue={data.atRisk.value}
              overdueFollowUps={data.atRisk.overdueFollowUps}
              staleOffers={data.atRisk.staleOffers}
              pipelineValue={data.pipelineValue}
              activeDeals={negotiating?.count ?? 0}
            />
            <PipelineBoard columns={data.board} />
          </div>
          <aside className="min-w-0 space-y-6">
            <InboxPreview conversations={data.conversations} />
            <StatsGrid contacted={data.stats.contacted} replies={data.stats.replies} offersSent={data.stats.offersSent} pipelineValue={data.stats.pipelineValue} />
            <TodayActivity activity={data.today} />
          </aside>
        </div>
      </div>
    </div>
    </InboxCommandCenter>
  );
}
