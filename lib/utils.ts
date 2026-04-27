import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.startsWith("1") && digits.length === 11) {
    return `+${digits}`;
  }

  return phone.startsWith("+") ? phone : `+${digits}`;
}

export function withStopLanguage(message: string) {
  const trimmed = message.trim();
  const stopText = " Reply STOP to opt out.";
  return trimmed.includes("Reply STOP to opt out.")
    ? trimmed
    : `${trimmed}${stopText}`;
}

export function formatStatusColor(status: string) {
  switch (status) {
    case "Hot":
      return "bg-[#eaf9f5] text-[#00c08b]";
    case "DNC":
      return "bg-[#fef2f2] text-[#e5484d]";
    case "Replied":
      return "bg-[#fef3c7] text-[#92400e]";
    case "Contacted":
      return "bg-[#eff6ff] text-[#1d4ed8]";
    case "Dead":
      return "bg-[#f3f4f6] text-[#6b7280]";
    default:
      return "bg-[#f3f4f6] text-[#6b7280]";
  }
}

export function formatClassificationColor(classification: string) {
  switch (classification) {
    case "HOT":
      return "bg-[#eaf9f5] text-[#00c08b]";
    case "WARM":
      return "bg-[#fef3c7] text-[#92400e]";
    case "COLD":
      return "bg-[#ede9fe] text-[#5b21b6]";
    case "DEAD":
    case "OPT_OUT":
      return "bg-[#f3f4f6] text-[#6b7280]";
    default:
      return "bg-[#f3f4f6] text-[#6b7280]";
  }
}
