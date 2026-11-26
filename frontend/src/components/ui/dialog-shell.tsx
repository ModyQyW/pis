import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import type { ReactNode } from "react";

import { t as tr } from "../../lib/i18n";
import { Close, Content, Description, Overlay, Title } from "./dialog-compat";

const widths = {
  sm: "max-w-[440px]",
  md: "max-w-[600px]",
  lg: "max-w-[720px]",
  xl: "max-w-[900px]",
} as const;

export type DialogWidth = keyof typeof widths;

export function DialogOverlay({ className }: { className?: string }) {
  return (
    <Overlay
      className={cn("fixed inset-0 z-40 bg-[var(--scrim)] backdrop-blur-[2px]", className)}
    />
  );
}

export function DialogSurface({
  width = "md",
  className,
  children,
}: {
  width?: DialogWidth;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Content
      className={cn(
        "fixed left-1/2 top-1/2 z-50 flex max-h-[min(760px,calc(100%-64px))] w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border-strong bg-surface shadow-dialog outline-none",
        widths[width],
        className,
      )}
    >
      {children}
    </Content>
  );
}

export function DialogHeader({
  title,
  description,
  icon,
  actions,
  closeLabel,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  closeLabel?: string;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-3.5">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-brand-ink">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <Title className="flex min-w-0 items-center gap-2 text-body-lg font-semibold tracking-[-0.01em]">
            {title}
          </Title>
          {description ? (
            <Description className="mt-0.5 text-label text-faint">{description}</Description>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <Close asChild>
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-sm text-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            aria-label={closeLabel ?? tr("Close")}
          >
            <X size={15} />
          </button>
        </Close>
      </div>
    </div>
  );
}
