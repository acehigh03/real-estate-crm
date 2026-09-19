import { redirect } from "next/navigation";

import { CampaignsClient } from "@/components/campaigns/campaigns-client";
import { getCampaignStats, type CampaignStats } from "@/lib/campaigns";
import { getCampaignsData } from "@/lib/data";
import { logError } from "@/lib/errors";
import { getAuthedAdmin } from "@/lib/route-admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let campaigns: CampaignStats[] = [];
  try {
    const auth = await getAuthedAdmin();
    if (auth) campaigns = await getCampaignStats(auth.admin, auth.user.id);
  } catch (error) {
    // Live stats are a bonus: fall back to the stored counters rather than an empty page.
    logError("campaigns page", error);
    campaigns = (await getCampaignsData()).map((campaign) => ({
      ...campaign,
      sends: campaign.messaged_count,
      replies: campaign.replied_count,
      replyRate: campaign.messaged_count ? Math.min(100, (campaign.replied_count / campaign.messaged_count) * 100) : null,
      lastSentAt: null,
      leadCount: campaign.total_leads,
    }));
  }

  return <CampaignsClient campaigns={campaigns} />;
}
