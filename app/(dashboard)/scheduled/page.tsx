import Link from "next/link";
import { Phone } from "lucide-react";

import { EmptyPanel, PageFrame } from "@/components/PageFrame";
import { LocalTime } from "@/components/LocalTime";
import { getScheduledData } from "@/lib/data";
import { fallbackAddress, leadDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BADGES = {
  overdue: { label: "Overdue", bg: "var(--redd)", color: "var(--red)" },
  today: { label: "Today", bg: "var(--ambd)", color: "var(--amb)" },
  upcoming: { label: "Upcoming", bg: "var(--s3)", color: "var(--t2)" },
} as const;

export default async function ScheduledPage() {
  const { leads } = await getScheduledData();
  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return (
    <PageFrame title="Scheduled" description="Every seller with a follow-up on the calendar, soonest first.">
      {leads.length === 0 ? (
        <EmptyPanel
          title="Nothing scheduled"
          body="Set a follow-up date on a lead and it will show up here."
          actionHref="/leads"
          actionLabel="Open Leads"
        />
      ) : (
        <ul className="crm-panel overflow-hidden">
          {leads.map((lead, index) => {
            const due = new Date(lead.next_follow_up_at as string).getTime();
            const kind = due < now ? "overdue" : due <= endOfToday.getTime() ? "today" : "upcoming";
            const badge = BADGES[kind];
            return (
              <li
                key={lead.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                style={index > 0 ? { borderTop: "1px solid var(--b1)" } : undefined}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link href={`/leads/${lead.id}`} className="text-[14px] font-semibold no-underline hover:underline" style={{ color: "var(--t1)" }}>
                      {leadDisplayName(lead)}
                    </Link>
                    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--t2)" }}>
                    {fallbackAddress(lead.property_address)}
                  </p>
                  <p className="mt-1 text-[13px]" style={{ color: "var(--t1)" }}>
                    <LocalTime iso={lead.next_follow_up_at} pattern="EEE, MMM d · h:mm a" />
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-medium no-underline"
                      style={{ background: "var(--g)", color: "var(--on-g)" }}
                    >
                      <Phone size={13} aria-hidden />
                      Call Lead
                    </a>
                  ) : null}
                  <Link
                    href={`/leads/${lead.id}?tab=tasks#deal-workspace`}
                    className="inline-flex h-9 items-center rounded-md px-3.5 text-[13px] font-medium no-underline"
                    style={{ background: "var(--s1)", color: "var(--t1)", border: "1px solid var(--b2)" }}
                  >
                    Reschedule
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
