import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Placeholder for sidebar sections that don't have a page yet, styled like the other
// dashboard pages (crm-page / crm-panel) so the nav never dead-ends in a 404.
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="crm-page flex flex-1 flex-col overflow-hidden">
      <div className="crm-page-header flex shrink-0 items-center justify-between gap-4 px-6 py-4">
        <h1 className="crm-header-title">{title}</h1>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="crm-panel max-w-md p-10 text-center">
          <p className="crm-section-kicker">{title}</p>
          <h2 className="mt-2 text-xl font-semibold" style={{ color: "var(--t1)" }}>
            Coming Soon
          </h2>
          <p className="mt-2 text-[13px]" style={{ color: "var(--t2)" }}>
            We&apos;re still building this section. Your leads, inbox, and pipeline are ready to use in the meantime.
          </p>
          <Link href="/dashboard" className="crm-button-secondary mt-6 inline-flex items-center gap-2">
            <ArrowLeft size={14} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
