import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
      return "bg-amber-100 text-amber-800";
    case "DNC":
      return "bg-rose-100 text-rose-700";
    case "Replied":
      return "bg-sky-100 text-sky-700";
    case "Contacted":
      return "bg-emerald-100 text-emerald-700";
    case "Dead":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
