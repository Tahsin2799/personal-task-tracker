import Link from "next/link";

/**
 * The field book's page header: the page title at left, pre-printed tally captions
 * with their values written in at right.
 */
export function PageHeader({
  title,
  crumb,
  fields = [],
  actions,
}: {
  title: string;
  crumb?: { href: string; label: string };
  fields?: { label: string; value: React.ReactNode; attention?: boolean }[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="rule-double flex flex-wrap items-end gap-x-8 gap-y-3 px-4 pt-5 pb-3 md:px-8 md:pt-7">
      <div className="flex min-w-0 items-baseline gap-2">
        {crumb && (
          <nav aria-label="Breadcrumb" className="flex shrink-0 items-baseline gap-2 text-[15px] text-pencil">
            <Link href={crumb.href} className="hover:text-ink hover:underline">
              {crumb.label}
            </Link>
            <span aria-hidden>/</span>
          </nav>
        )}
        <h1 className="truncate font-stamp text-[30px] font-semibold uppercase leading-none tracking-[0.02em] md:text-[34px]">
          {title}
        </h1>
      </div>
      {(fields.length > 0 || actions) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:ml-auto">
          {fields.length > 0 && (
            <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              {fields.map((f) => (
                <div key={f.label} className="flex items-baseline gap-2">
                  <dt className="stamp text-[11px] text-pencil">{f.label}</dt>
                  <dd className={`font-mono text-[14px] ${f.attention ? "font-semibold text-attention" : ""}`}>
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {actions}
        </div>
      )}
    </header>
  );
}
