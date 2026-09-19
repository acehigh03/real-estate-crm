import { renderTemplate } from "@/lib/automation/rules";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

/** Fills [[first_name]] / [[address]] (and the older {{first_name}}) from a lead. Unknown tokens stay visible. */
export function renderDripMessage(template: string, lead: Pick<Lead, "first_name" | "last_name" | "property_address" | "city">) {
  return renderTemplate(template, lead);
}

export function formatDelay(minutes: number) {
  if (minutes === 0) return "Immediately";
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${minutes} min`;
}
