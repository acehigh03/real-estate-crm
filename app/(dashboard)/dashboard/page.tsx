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

  const { counts, dueLeads, recentReplies } =
    await getDashboardStats();

  return (
    <DashboardClient
      userName={userName}
      userInitials={userInitials || "SB"}
      counts={counts}
      dueLeads={dueLeads}
      recentReplies={recentReplies}
    />
  );
}
