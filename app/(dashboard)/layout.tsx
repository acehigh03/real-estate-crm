import { redirect } from "next/navigation";

import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getInboxBadgeCount, getCampaignCount } from "@/lib/data";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let inboxBadgeCount = 0;
  let campaignCount = 0;

  try {
    [inboxBadgeCount, campaignCount] = await Promise.all([
      getInboxBadgeCount(),
      getCampaignCount(),
    ]);
  } catch (error) {
    console.error("dashboard layout data failed:", error);
  }

  void inboxBadgeCount;
  void campaignCount;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "204px 1fr",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Sidebar activeItem="Dashboard" />
      <main
        style={{
          overflowY: "auto",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </main>
    </div>
  );
}
