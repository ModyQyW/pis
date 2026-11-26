import { cn } from "../../lib/cn";
import type { ReactNode } from "react";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-sm border border-border bg-surface px-1 font-mono text-micro font-normal text-faint",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
