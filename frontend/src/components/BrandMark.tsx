import { cn } from "../lib/cn";

/** The product mark used in the app shell. */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/icon.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-[9px]", className)}
    />
  );
}
