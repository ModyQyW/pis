import { ChevronRight, Command, PanelRight, Search } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { t } from "../lib/i18n";
import type { RunState, Workspace } from "../lib/types";

const stateLabel: Record<RunState, string> = {
  idle: "Ready",
  working: "Working",
  "needs-input": "Needs input",
  error: "Error",
  sleeping: "Sleeping",
};

export function TopBar({
  workspace,
  title,
  state,
  rightOpen,
  sidebarOpen,
  preview,
  sessionActions,
  onPalette,
  onToggleRight,
}: {
  workspace: Workspace | null;
  title: string;
  state: RunState;
  rightOpen: boolean;
  sidebarOpen: boolean;
  preview?: boolean;
  sessionActions?: ReactNode;
  onPalette: () => void;
  onToggleRight: () => void;
}) {
  return (
    <header
      className={cn(
        "drag flex h-[52px] shrink-0 items-center gap-3 border-b border-border/70 px-4",
        !sidebarOpen && "pl-[calc(var(--mygo-titlebar-inset-left,0px)+16px)]",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[12px]">
        <span className="truncate text-subtle">{workspace?.name ?? t("No project")}</span>
        <ChevronRight size={12} className="shrink-0 text-faint" />
        <span className="truncate font-medium text-fg">{title}</span>
      </div>

      <div className="no-drag ml-auto flex items-center gap-1.5">
        {preview ? (
          <span className="mr-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[9.5px] text-faint">
            {t("Preview")}
          </span>
        ) : null}
        <span
          className={cn(
            "mr-1 inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[10.5px] font-medium",
            state === "working" && "border-brand/30 bg-brand-soft text-brand",
            state === "needs-input" && "border-warning/30 bg-warning/10 text-warning",
            state === "error" && "border-danger/30 bg-danger/10 text-danger",
            state === "idle" && "border-border bg-surface text-subtle",
            state === "sleeping" && "border-border bg-surface text-faint",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              state === "working" && "bg-brand pulse-soft",
              state === "needs-input" && "bg-warning",
              state === "error" && "bg-danger",
              state === "idle" && "bg-success/70",
              state === "sleeping" && "bg-faint",
            )}
          />
          {t(stateLabel[state])}
        </span>

        {sessionActions}
        <button
          type="button"
          onClick={onPalette}
          className="flex h-7 items-center gap-2 rounded-md border border-border bg-surface px-2 text-[11px] text-subtle transition-colors hover:border-border-strong hover:text-fg"
          title={t("Command palette")}
        >
          <Search size={12} />
          <span className="hidden sm:inline">{t("Commands")}</span>
          <span className="ml-1 flex items-center gap-0.5 rounded border border-border/80 px-1 py-0.5 text-[9.5px] text-faint">
            <Command size={9} />K
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleRight}
          className={cn(
            "flex size-7 items-center justify-center rounded-md border transition-colors",
            rightOpen
              ? "border-border-strong bg-surface-3 text-fg"
              : "border-transparent text-subtle hover:bg-surface-2 hover:text-fg",
          )}
          title={t("Toggle changes panel")}
          aria-label={t("Toggle changes panel")}
        >
          <PanelRight size={14} />
        </button>
      </div>
    </header>
  );
}
