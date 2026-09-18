"use client";

import { format } from "date-fns";

// Formats in the viewer's timezone. The server (UTC on Vercel) would show the wrong hour,
// so the browser's rendering wins and the expected server/client difference is not an error.
export function LocalTime({ iso, pattern = "MMM d, h:mm a" }: { iso: string | null | undefined; pattern?: string }) {
  if (!iso) return <>—</>;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return <>—</>;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {format(date, pattern)}
    </time>
  );
}
