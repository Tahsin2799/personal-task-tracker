import { initials } from "@/lib/format";

const SIZES = {
  sm: "size-6 text-[10.5px]",
  md: "size-7 text-[11px]",
  lg: "size-9 text-[12.5px]",
} as const;

/** A person as their initials on a small filled square: hairline corners, never a circle (circles are points). */
export function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-[2px] border border-rule-mid bg-page-sunk font-semibold tracking-[0.02em] text-ink ${SIZES[size]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
