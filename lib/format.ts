// Formatting shared by the command-center pages. Times use one fixed timezone so the server
// render and the browser render always agree (no hydration mismatches).
const TZ = "America/Chicago";

export function formatMoney(value: number | null | undefined): string {
  return `$${Math.round(Number(value ?? 0)).toLocaleString("en-US")}`;
}

/** "$1.2M" / "$450K" for tight spaces (column headers). */
export function formatMoneyCompact(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return formatMoney(n);
}

const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TZ });

/** "3:15 PM" today, "Yesterday", "Sep 12" otherwise. */
export function formatShort(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const today = dayKey(now);
  if (dayKey(date) === today) return date.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  if (dayKey(date) === yesterday) return "Yesterday";
  return date.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });
}

/** "Sep 19, 3:15 PM" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });
}

/** "5m ago", "3h ago", "2d ago" */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "Never";
  const diff = now - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function isPast(iso: string | null | undefined, now = Date.now()): boolean {
  return !!iso && new Date(iso).getTime() < now;
}

export function formatPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return national.length === 10 ? `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}` : phone ?? "";
}
