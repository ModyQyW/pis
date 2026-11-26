import { cn } from "../../lib/cn";
import type { ReactNode } from "react";

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-micro font-medium uppercase tracking-label text-faint", className)}>
      {children}
    </div>
  );
}
