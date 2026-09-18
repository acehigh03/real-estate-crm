import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
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

  void campaignCount;

  return (
    <AppShell
      sidebar={<Sidebar activeItem="Dashboard" inboxBadge={inboxBadgeCount} userEmail={user.email ?? ""} />}
    >
      {children}
    </AppShell>
  );
}
