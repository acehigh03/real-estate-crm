import { withStopLanguage } from "@/lib/utils";

export type SmsCampaignType = "cash_offer" | "foreclosure_help";

interface TemplateLead {
  id?: string | null;
  phone_normalized?: string | null;
  first_name?: string | null;
  property_address?: string | null;
  lead_source?: string | null;
  tag?: string | null;
}

const TEMPLATE_LIBRARY: Record<SmsCampaignType, string[]> = {
  cash_offer: [
    "{{Hey|Hi|Hello}} [[first_name]], {{this is|it's}} Senay with Texas Relief Group. {{Quick question -|Just checking -|Wanted to ask -}} is [[address]] still yours? {{I came across it|I saw it}} and wanted to see if you'd be open to {{a cash offer|an as-is cash offer}}. {{Reply YES or NO.|Would you consider it? Reply YES or NO.}}",
    "{{Hey|Hi|Hello}} [[first_name]], {{this is|it's}} Senay with Texas Relief Group. {{Quick question -|Just checking -|Wanted to ask -}} I was looking at [[address]] and wanted to see if you'd consider {{a cash offer|an as-is cash offer}}. {{Reply YES or NO.|Would you be open to that? Reply YES or NO.}}",
    "{{Hey|Hi|Hello}} [[first_name]], {{this is|it's}} Senay with Texas Relief Group. {{Wanted to ask -|Quick question -|Just checking -}} is [[address]] a property you’d ever consider selling? {{I came across it|I saw it}} and may be able to make {{a cash offer|an as-is cash offer}}. {{Reply YES or NO.|Let me know with YES or NO.}}",
  ],
  foreclosure_help: [
    "{{Hey|Hi|Hello}} [[first_name]], {{this is|it's}} Senay with Texas Relief Group. {{Quick question -|Just checking -|Wanted to ask -}} is [[address]] still yours? {{Looks like|Seems like}} it may be {{heading toward|facing}} foreclosure. {{There may still be time to|You may still have time to}} {{delay|pause}} it before the auction. {{Want me to take a quick look?|Want me to check what options you have?}}",
    "{{Hey|Hi|Hello}} [[first_name]], {{this is|it's}} Senay with Texas Relief Group. {{Wanted to ask -|Quick question -|Just checking -}} are you the owner of [[address]]? {{Looks like|Seems like}} it may be {{heading toward|facing}} foreclosure, and {{there may still be time to|you may still have time to}} {{delay|pause}} it before auction. {{Want me to take a quick look?|Want me to check your options?}}",
    "{{Hey|Hi|Hello}} [[first_name]], {{this is|it's}} Senay with Texas Relief Group. {{Just checking -|Wanted to ask -|Quick question -}} is [[address]] still yours? {{It looks like|Seems like}} foreclosure may be coming up. {{There may still be time to|You may still have time to}} {{delay|pause}} that process. {{Want me to take a quick look?|Want me to check what options may be available?}}",
  ],
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function templateSeed(lead: TemplateLead) {
  return lead.id || lead.phone_normalized || `${lead.first_name ?? ""}-${lead.property_address ?? ""}`;
}

function normalizeTemplateValue(value: string | null | undefined, fallback: string) {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : fallback;
}

export function renderTemplate(template: string, lead: TemplateLead) {
  const seed = hashString(templateSeed(lead));
  let spinIndex = 0;

  const withSpintax = template.replace(/\{\{([^{}]+)\}\}/g, (_match, group: string) => {
    const options = group.split("|").map((option) => option.trim()).filter(Boolean);
    if (!options.length) return "";
    const optionIndex = hashString(`${seed}:${spinIndex}`) % options.length;
    spinIndex += 1;
    return options[optionIndex];
  });

  return withSpintax
    .replaceAll("[[first_name]]", normalizeTemplateValue(lead.first_name, "there"))
    .replaceAll("[[address]]", normalizeTemplateValue(lead.property_address, "your property"));
}

export function pickTemplateVariant(lead: TemplateLead, campaignType: SmsCampaignType) {
  const templates = TEMPLATE_LIBRARY[campaignType];
  const seed = hashString(`${campaignType}:${templateSeed(lead)}`);
  return templates[seed % templates.length];
}

export function resolveCampaignTypeForLead(lead: TemplateLead): SmsCampaignType {
  const haystack = `${lead.tag ?? ""} ${lead.lead_source ?? ""}`.toLowerCase();
  return haystack.includes("foreclosure") ? "foreclosure_help" : "cash_offer";
}

export function buildFirstSmsForLead(lead: TemplateLead, campaignType?: SmsCampaignType) {
  const selectedCampaign = campaignType ?? resolveCampaignTypeForLead(lead);
  const template = pickTemplateVariant(lead, selectedCampaign);
  const rendered = renderTemplate(template, lead);
  return {
    campaignType: selectedCampaign,
    template,
    message: withStopLanguage(rendered),
  };
}
