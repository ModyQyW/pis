import { useState } from "react";

import { cn } from "../lib/cn";
import { t } from "../lib/i18n";

const ANSI =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

function clean(text: string): string {
  return text.replace(ANSI, "").replace(/\s+/g, " ").trim();
}

export function ExtensionStatusRail({
  statuses,
  widgets,
  showWidgets,
}: {
  statuses: Record<string, string>;
  widgets: Record<string, string[]>;
  showWidgets?: boolean;
}) {
  const [openWidgets, setOpenWidgets] = useState(false);
  const items = Object.entries(statuses)
    .map(([key, value]) => ({ key, value: clean(value) }))
    .filter((item) => item.value.length > 0)
    .slice(0, 6);
  const widgetKeys = Object.keys(widgets);
  if (items.length === 0 && (!showWidgets || widgetKeys.length === 0)) return null;

  return (
    <div className="mx-auto w-full max-w-chat px-5 pb-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item) => (
          <span
            key={item.key}
            title={item.key}
            className="max-w-[260px] truncate rounded-full border border-border bg-surface/70 px-2 py-0.5 text-micro text-faint"
          >
            {item.value}
          </span>
        ))}
        {showWidgets && widgetKeys.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpenWidgets((v) => !v)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-micro transition-colors",
              openWidgets
                ? "border-border-strong bg-surface-3 text-fg"
                : "border-border bg-surface/70 text-faint hover:text-subtle",
            )}
          >
            {widgetKeys.length === 1
              ? t("1 widget")
              : t("{count} widgets", { count: widgetKeys.length })}
          </button>
        ) : null}
      </div>
      {showWidgets && openWidgets ? (
        <div className="mt-1.5 max-h-[180px] overflow-y-auto scroll-thin rounded-lg border border-border bg-surface p-2">
          {Object.entries(widgets).map(([key, lines]) => (
            <div key={key} className="mb-1 last:mb-0">
              <div className="text-micro uppercase tracking-label text-faint">{key}</div>
              <pre className="whitespace-pre-wrap font-mono code-text-dense leading-4 text-subtle">
                {lines.map(clean).join("\n")}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
