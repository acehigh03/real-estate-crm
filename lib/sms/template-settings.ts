import { DEFAULT_FIRST_SMS_TEMPLATES, type SmsCampaignType } from "@/lib/sms/templates";

export const MESSAGE_TEMPLATE_STORAGE_KEY = "crm.message-templates.v1";

export type SavedMessageTemplates = Record<SmsCampaignType, string>;

export function getDefaultMessageTemplates(): SavedMessageTemplates {
  return { ...DEFAULT_FIRST_SMS_TEMPLATES };
}

export function readSavedMessageTemplates(): SavedMessageTemplates {
  const defaults = getDefaultMessageTemplates();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(MESSAGE_TEMPLATE_STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<Record<SmsCampaignType, unknown>>;
    return (Object.keys(defaults) as SmsCampaignType[]).reduce((templates, type) => {
      const value = saved[type];
      templates[type] = typeof value === "string" ? value : defaults[type];
      return templates;
    }, { ...defaults });
  } catch {
    return defaults;
  }
}

export function saveMessageTemplates(templates: SavedMessageTemplates) {
  window.localStorage.setItem(MESSAGE_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}
