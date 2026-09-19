import { redirect } from "next/navigation";

import { PipelineKanban } from "@/components/pipeline/pipeline-kanban";
import { BOARD_COLUMNS } from "@/lib/board";
import { getLeadsByStage } from "@/lib/dashboard";
import { logError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let columns = BOARD_COLUMNS.map((column) => ({ key: column.key, label: column.label, emptyText: column.emptyText, emptyHref: column.emptyHref, count: 0, value: 0, leads: [] as Awaited<ReturnType<typeof getLeadsByStage>>[number]["leads"] }));
  try {
    columns = await getLeadsByStage(200);
  } catch (error) {
    logError("pipeline page", error);
  }

  return <PipelineKanban initialColumns={columns} />;
}
