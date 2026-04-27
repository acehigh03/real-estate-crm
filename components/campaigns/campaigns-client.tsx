"use client";

import { useRouter } from "next/navigation";
import type { Database, CampaignType } from "@/types/database";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];

const TYPE_LABELS: Record<CampaignType, string> = {
  cash_offer: "Cash Offer",
  foreclosure_help: "Foreclosure",
  probate: "Probate",
  tax_sale: "Tax Sale",
};

const TYPE_CLASSES: Record<CampaignType, string> = {
  cash_offer: "bg-[#eff6ff] text-[#1d4ed8]",
  foreclosure_help: "bg-[#fef2f2] text-[#e5484d]",
  probate: "bg-[#ede9fe] text-[#5b21b6]",
  tax_sale: "bg-[#fef3c7] text-[#92400e]",
};

function TypeBadge({ type }: { type: CampaignType | null }) {
  if (!type) return <span className="text-[#6b7c93]">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_CLASSES[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

function replyRate(campaign: Campaign): string {
  if (!campaign.messaged_count) return "—";
  const rate = (campaign.replied_count / campaign.messaged_count) * 100;
  return `${rate.toFixed(1)}%`;
}

interface CampaignsClientProps {
  campaigns: Campaign[];
}

export function CampaignsClient({ campaigns }: CampaignsClientProps) {
  const router = useRouter();

  const totalLeads = campaigns.reduce((s, c) => s + c.total_leads, 0);
  const totalMessaged = campaigns.reduce((s, c) => s + c.messaged_count, 0);
  const ratedCampaigns = campaigns.filter((c) => c.messaged_count > 0);
  const avgReplyRate =
    ratedCampaigns.length > 0
      ? ratedCampaigns.reduce((s, c) => s + c.replied_count / c.messaged_count, 0) /
        ratedCampaigns.length *
        100
      : null;

  const stats = [
    { label: "Total Campaigns", value: campaigns.length },
    { label: "Total Leads", value: totalLeads },
    { label: "Messaged", value: totalMessaged },
    { label: "Avg Reply Rate", value: avgReplyRate !== null ? `${avgReplyRate.toFixed(1)}%` : "—" },
  ];

  return (
    <div className="crm-page flex flex-1 flex-col overflow-hidden">
      <div className="crm-page-header flex shrink-0 items-center justify-between gap-4 px-6 py-4">
        <h1 className="crm-header-title">Campaigns</h1>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {/* Stats row */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[10px] border border-[#eaecf0] bg-white px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#6b7c93]">{s.label}</p>
              <p className="mt-1.5 text-[26px] font-semibold leading-none text-[#1a1f36]">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {campaigns.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-[10px] border border-[#eaecf0] bg-white">
            <p className="text-sm text-[#6b7c93]">
              No campaigns yet. Import a CSV to create one.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-[#eaecf0] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#f7f8fa]">
                <tr className="border-b border-[#e8edf2]">
                  {["Campaign", "Type", "Leads", "Messaged", "Replied", "Hot", "Reply Rate"].map((h) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[#6b7c93] ${
                        h === "Campaign" ? "text-left" : "text-right"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/leads?campaign=${c.id}`)}
                    className="cursor-pointer border-b border-[#e8edf2] transition hover:bg-[#f7f8fa] last:border-0"
                  >
                    <td className="px-5 py-4 font-medium text-[#1a1f36]">{c.name}</td>
                    <td className="px-5 py-4 text-right">
                      <TypeBadge type={c.campaign_type} />
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-[#1a1f36]">{c.total_leads}</td>
                    <td className="px-5 py-4 text-right font-mono text-[#1a1f36]">{c.messaged_count}</td>
                    <td className="px-5 py-4 text-right font-mono text-[#1a1f36]">{c.replied_count}</td>
                    <td className="px-5 py-4 text-right font-mono text-[#1a1f36]">{c.hot_count}</td>
                    <td className="px-5 py-4 text-right font-mono text-[#00c08b]">{replyRate(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
