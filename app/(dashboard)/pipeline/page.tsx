import { getPipelineData } from "@/lib/data";
import { PipelineClient } from "@/components/pipeline/pipeline-client";

export default async function PipelinePage() {
  let cards: Awaited<ReturnType<typeof getPipelineData>>["cards"] = [];

  try {
    const data = await getPipelineData();
    cards = data.cards;
  } catch (error) {
    console.error("pipeline page data failed:", error);
  }

  return <PipelineClient cards={cards} />;
}
