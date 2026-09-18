import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

/** Replaces only supported fields; unknown tokens intentionally remain visible for review. */
export function renderDripMessage(template: string, lead: Pick<Lead, "first_name" | "last_name" | "property_address" | "city">) {
  const fields: Record<string, string> = {
    first_name: lead.first_name?.trim() || "there",
    last_name: lead.last_name?.trim() || "",
    property_address: lead.property_address?.trim() || "your property",
    city: lead.city?.trim() || "",
  };
  return template.replace(/{{\s*(first_name|last_name|property_address|city)\s*}}/g, (_, key: string) => fields[key]);
}

export function formatDelay(minutes: number) {
  if (minutes === 0) return "Immediately";
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${minutes} min`;
}
