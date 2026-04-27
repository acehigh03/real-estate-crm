import { getPipelineData } from "@/lib/data";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";

export default async function PipelinePage() {
  const { stageOrder, cards } = await getPipelineData();

  return <PipelineBoard stageOrder={stageOrder} cards={cards} />;
}
