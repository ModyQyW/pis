import { cn } from "../lib/cn";

/** The product mark: a pi glyph in a quiet rounded square. */
export function BrandMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface-2 text-fg",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.68}
        height={size * 0.68}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.5 8.5h15" />
        <path d="M9 8.5V20" />
        <path d="M15 8.5V20" />
        <path d="M15 8.5c0-1.7 1.2-3 3-3" />
      </svg>
    </span>
  );
}
