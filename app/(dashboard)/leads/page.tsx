import { getLeadsPageData } from "@/lib/data";
import { LeadsClient } from "@/components/leads/leads-client";

export default async function LeadsPage() {
  const { leads, notes, followups, campaigns } = await getLeadsPageData();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <LeadsClient leads={leads} notes={notes} followups={followups} campaigns={campaigns} />
    </div>
  );
}
