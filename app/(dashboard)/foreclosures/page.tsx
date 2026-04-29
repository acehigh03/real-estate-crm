import { ForeclosuresClient } from "@/components/foreclosures/foreclosures-client";
import { getForeclosuresData } from "@/lib/data";

export default async function ForeclosuresPage() {
  const { rows, tableMissing } = await getForeclosuresData();

  return <ForeclosuresClient rows={rows} tableMissing={tableMissing} />;
}
