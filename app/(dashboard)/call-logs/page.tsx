import Link from "next/link";

import { EmptyPanel, PageFrame } from "@/components/PageFrame";
import { LocalTime } from "@/components/LocalTime";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCallLogsData } from "@/lib/data";
import { formatPhoneDisplay, leadDisplayName, messageSnippet } from "@/lib/utils";

export const dynamic = "force-dynamic";

function statusStyle(status: string | null) {
  const value = (status ?? "").toLowerCase();
  if (value === "delivered") return { bg: "var(--gd)", color: "var(--g)", label: "Delivered" };
  if (value.includes("fail") || value === "undelivered" || value === "delivery_failed") {
    return { bg: "var(--redd)", color: "var(--red)", label: "Failed" };
  }
  if (value === "sending" || value === "queued" || value === "sending_failed") {
    return { bg: "var(--s3)", color: "var(--t2)", label: value === "queued" ? "Queued" : "Sending" };
  }
  return { bg: "var(--s3)", color: "var(--t2)", label: value ? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Sent" };
}

export default async function CallLogsPage() {
  const { rows, limit } = await getCallLogsData();

  return (
    <PageFrame
      title="Call Logs"
      description="Every text you've sent, newest first. Phone call tracking isn't available yet."
    >
      {rows.length === 0 ? (
        <EmptyPanel
          title="No texts sent yet"
          body="Once you message a seller, every send shows up here with its delivery status."
          actionHref="/inbox?new=1"
          actionLabel="Start a Conversation"
        />
      ) : (
        <div className="crm-panel overflow-hidden">
          <Table className="min-w-[680px]">
            <TableHeader style={{ background: "var(--s2)" }}>
              <TableRow className="hover:bg-transparent" style={{ borderColor: "var(--b1)" }}>
                {["When", "Lead", "Message", "Status"].map((heading) => (
                  <TableHead key={heading} className="px-4 py-3 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--t2)" }}>
                    {heading}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ message, lead }) => {
                const status = statusStyle(message.status);
                return (
                  <TableRow key={message.id} style={{ borderColor: "var(--b1)" }}>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-[13px]" style={{ color: "var(--t2)" }}>
                      <LocalTime iso={message.created_at} pattern="MMM d, h:mm a" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {lead ? (
                        <Link href={`/leads/${lead.id}`} className="text-[13px] font-semibold no-underline hover:underline" style={{ color: "var(--t1)" }}>
                          {leadDisplayName({ first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone })}
                        </Link>
                      ) : (
                        <span className="text-[13px]" style={{ color: "var(--t2)" }}>
                          {formatPhoneDisplay(message.to_number)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate px-4 py-3 text-[13px]" style={{ color: "var(--t1)" }}>
                      {messageSnippet(message.body, 90)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length >= limit ? (
            <p className="px-4 py-3 text-[12px]" style={{ borderTop: "1px solid var(--b1)", color: "var(--t3)" }}>
              Showing the latest {limit} texts.
            </p>
          ) : null}
        </div>
      )}
    </PageFrame>
  );
}
