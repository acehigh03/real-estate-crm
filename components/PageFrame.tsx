import Link from "next/link";

// Shared header + body for simple list pages (Scheduled, Call Logs, Tags).
export function PageFrame({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="crm-page flex flex-1 flex-col">
      <div className="crm-page-header flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="crm-header-title">{title}</h1>
          {description ? <p className="crm-header-copy">{description}</p> : null}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}

export function EmptyPanel({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="crm-panel flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-[14px] font-medium" style={{ color: "var(--t1)" }}>
        {title}
      </p>
      <p className="max-w-sm text-[13px]" style={{ color: "var(--t2)" }}>
        {body}
      </p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="crm-button-primary mt-3 inline-flex no-underline">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
