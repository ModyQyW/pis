import { cn } from "../../lib/cn";
import type { ReactNode } from "react";

export type PillTone = "neutral" | "ready" | "brand" | "success" | "warning" | "danger" | "faint";

const tones: Record<PillTone, { box: string; dot: string }> = {
  neutral: { box: "border-border bg-surface text-subtle", dot: "bg-faint" },
  ready: { box: "border-border bg-surface text-subtle", dot: "bg-success" },
  brand: { box: "border-brand/35 bg-brand-soft text-brand-ink", dot: "bg-brand pulse-soft" },
  success: { box: "border-success/30 bg-success/10 text-success", dot: "bg-success" },
  warning: { box: "border-warning/30 bg-warning/10 text-warning", dot: "bg-warning" },
  danger: { box: "border-danger/30 bg-danger/10 text-danger", dot: "bg-danger" },
  faint: { box: "border-border bg-surface text-faint", dot: "bg-faint" },
};

export function StatusPill({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const style = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-micro font-medium",
        style.box,
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} /> : null}
      {children}
    </span>
  );
}
