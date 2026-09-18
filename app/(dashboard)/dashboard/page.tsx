import { createClient } from "@/lib/supabase/server";
import { EMPTY_ATTENTION, EMPTY_REVENUE_METRICS, getDashboardStats } from "@/lib/data";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { makeDemoView } from "@/components/dashboard/demo-view";
import { EMPTY_DASHBOARD_VIEW } from "@/lib/dashboard-view";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "";
  // "senay24@gmail.com" -> "Senay": drop digits, split on separators, capitalise.
  const namePart = (email.split("@")[0] ?? "").replace(/\d+/g, "");
  const userName =
    namePart
      .split(/[._-]/)
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ") || "there";
  const userInitials = namePart
    .split(/[._-]/)
    .map((s) => s.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  let counts = {
    totalLeads: 0,
    contactedLeads: 0,
    repliesReceived: 0,
    hotLeads: 0,
    dueToday: 0,
  };
  let dueLeads = [] as Awaited<ReturnType<typeof getDashboardStats>>["dueLeads"];
  let recentReplies = [] as Awaited<ReturnType<typeof getDashboardStats>>["recentReplies"];
  let hotLeadRows = [] as Awaited<ReturnType<typeof getDashboardStats>>["hotLeadRows"];
  let campaignPerformance = [] as Awaited<ReturnType<typeof getDashboardStats>>["campaignPerformance"];
  let revenue = EMPTY_REVENUE_METRICS;
  let attention = EMPTY_ATTENTION;
  let view = EMPTY_DASHBOARD_VIEW;

  // ?demo=1 previews the layout with fictional sample data. It is built in memory for this
  // request only — nothing is written anywhere — and real accounts never get it unasked.
  const isDemo = demo === "1";
  if (isDemo) {
    view = makeDemoView(new Date());
  } else {
    try {
      ({ counts, dueLeads, recentReplies, hotLeadRows, campaignPerformance, revenue, attention, view } =
        await getDashboardStats());
    } catch (error) {
      console.error("dashboard page data failed:", error);
    }
  }

  return (
    <DashboardClient
      userName={userName}
      userInitials={userInitials || "•"}
      counts={counts}
      dueLeads={dueLeads}
      recentReplies={recentReplies}
      hotLeadRows={hotLeadRows}
      campaignPerformance={campaignPerformance}
      revenue={revenue}
      attention={attention}
      view={view}
    />
  );
}
