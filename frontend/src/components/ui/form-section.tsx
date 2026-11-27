import type { ReactNode } from "react";

import { SectionLabel } from "./section-label";

/** A settings form section with an optional action and divider. */
export function FormSection({
  title,
  description,
  actions,
  divided,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  divided?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={
        divided
          ? "mb-6 border-t border-border pt-4 first:border-t-0 first:pt-0 last:mb-1"
          : "mb-6 last:mb-1"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionLabel>{title}</SectionLabel>
          {description ? (
            <p className="mt-1 max-w-[620px] text-label leading-4 text-faint">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}
