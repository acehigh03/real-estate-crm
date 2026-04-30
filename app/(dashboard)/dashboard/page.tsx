import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/data";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "";
  const namePart = email.split("@")[0] ?? "";
  const userName =
    namePart
      .split(/[._-]/)
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

  try {
    ({ counts, dueLeads, recentReplies, hotLeadRows, campaignPerformance } =
      await getDashboardStats());
  } catch (error) {
    console.error("dashboard page data failed:", error);
  }

  return (
    <DashboardClient
      userName={userName}
      userInitials={userInitials || "SB"}
      counts={counts}
      dueLeads={dueLeads}
      recentReplies={recentReplies}
      hotLeadRows={hotLeadRows}
      campaignPerformance={campaignPerformance}
    />
  );
}
