// Campaign list with live send/reply numbers (the stored counters are only a fallback).
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;
type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];

export interface CampaignStats extends Campaign {
  sends: number;
  replies: number;
  replyRate: number | null;
  lastSentAt: string | null;
  leadCount: number;
}

const chunk = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

/** The deterministic drip-workflow name a launched campaign runs under (used to pause/resume it). */
export const campaignWorkflowName = (campaign: Pick<Campaign, "id" | "name">) => `Campaign: ${campaign.name} (${campaign.id.slice(0, 8)})`;

export async function getCampaignStats(admin: Admin, userId: string): Promise<CampaignStats[]> {
  const { data: campaigns, error } = await admin.from("campaigns").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  if (!campaigns?.length) return [];

  const ids = campaigns.map((campaign) => campaign.id);
  const { data: leads } = await admin.from("leads").select("id, campaign_id, last_replied_at").eq("user_id", userId).in("campaign_id", ids).limit(5000);
  const leadCampaign = new Map((leads ?? []).map((lead) => [lead.id, lead.campaign_id as string]));

  const sends = new Map<string, number>();
  const lastSent = new Map<string, string>();
  const leadIds = [...leadCampaign.keys()];
  for (const group of chunk(leadIds, 150).slice(0, 30)) {
    const { data: messages } = await admin.from("messages").select("lead_id, created_at").eq("user_id", userId).eq("direction", "outbound").in("lead_id", group).limit(5000);
    for (const message of messages ?? []) {
      const campaignId = message.lead_id ? leadCampaign.get(message.lead_id) : undefined;
      if (!campaignId) continue;
      sends.set(campaignId, (sends.get(campaignId) ?? 0) + 1);
      if (!lastSent.get(campaignId) || lastSent.get(campaignId)! < message.created_at) lastSent.set(campaignId, message.created_at);
    }
  }

  return campaigns.map((campaign) => {
    const mine = (leads ?? []).filter((lead) => lead.campaign_id === campaign.id);
    const liveSends = sends.get(campaign.id) ?? 0;
    const liveReplies = mine.filter((lead) => lead.last_replied_at).length;
    const sent = Math.max(liveSends, campaign.messaged_count ?? 0);
    const replies = Math.max(liveReplies, campaign.replied_count ?? 0);
    return {
      ...campaign,
      sends: sent,
      replies,
      // Reply rate is per person texted, so it can't exceed 100% when someone is texted twice.
      replyRate: sent > 0 ? Math.min(100, (replies / Math.max(1, Math.min(sent, mine.length || sent))) * 100) : null,
      lastSentAt: lastSent.get(campaign.id) ?? null,
      leadCount: Math.max(mine.length, campaign.total_leads ?? 0),
    };
  });
}
