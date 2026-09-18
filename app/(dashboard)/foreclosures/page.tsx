import { ForeclosuresClient } from "@/components/foreclosures/foreclosures-client";
import { getForeclosuresData } from "@/lib/data";

// Reads the signed-in user's cookies; must never be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function ForeclosuresPage() {
  try {
    const { rows, tableMissing } = await getForeclosuresData();
    return <ForeclosuresClient rows={rows} tableMissing={tableMissing} />;
  } catch (error) {
    console.error("foreclosures page data failed:", error);
    return <ForeclosuresClient rows={[]} tableMissing />;
  }
}
