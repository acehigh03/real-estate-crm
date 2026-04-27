import { redirect } from "next/navigation";

import { getCampaignsData } from "@/lib/data";
import { CampaignsClient } from "@/components/campaigns/campaigns-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const campaigns = await getCampaignsData();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <CampaignsClient campaigns={campaigns} />
    </div>
  );
}
