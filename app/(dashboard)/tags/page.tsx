import Link from "next/link";

import { EmptyPanel, PageFrame } from "@/components/PageFrame";
import { getTagsData } from "@/lib/data";
import { leadDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PREVIEW = 5;

export default async function TagsPage() {
  const { groups, untagged } = await getTagsData();

  return (
    <PageFrame title="Tags" description="The labels you've put on leads, and who has each one.">
      {groups.length === 0 ? (
        <EmptyPanel
          title="No tags yet"
          body="Add a tag to any lead (open the lead, then Lead actions) and it will be listed here."
          actionHref="/leads"
          actionLabel="Open Leads"
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <section key={group.tag} className="crm-panel overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <h2 className="min-w-0 truncate text-[14px] font-semibold" style={{ color: "var(--t1)" }}>
                    {group.tag}
                  </h2>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums" style={{ background: "var(--gd)", color: "var(--g)" }}>
                    {group.leads.length} {group.leads.length === 1 ? "lead" : "leads"}
                  </span>
                </div>
                <ul>
                  {group.leads.slice(0, PREVIEW).map((lead) => (
                    <li key={lead.id} style={{ borderTop: "1px solid var(--b1)" }}>
                      <Link href={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] no-underline hover:bg-[var(--s2)]" style={{ color: "var(--t1)" }}>
                        <span className="truncate">{leadDisplayName(lead)}</span>
                        <span className="shrink-0 text-[12px]" style={{ color: "var(--t3)" }}>{lead.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {group.leads.length > PREVIEW ? (
                  <p className="px-4 py-2.5 text-[12px]" style={{ borderTop: "1px solid var(--b1)", color: "var(--t3)" }}>
                    +{group.leads.length - PREVIEW} more
                  </p>
                ) : null}
              </section>
            ))}
          </div>
          {untagged > 0 ? (
            <p className="mt-4 text-[13px]" style={{ color: "var(--t2)" }}>
              {untagged} {untagged === 1 ? "lead has" : "leads have"} no tag.
            </p>
          ) : null}
        </>
      )}
    </PageFrame>
  );
}
