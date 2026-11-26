import { ChevronRight, Command, PanelLeft, PanelRight, Search } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { t } from "../lib/i18n";
import type { RunState, Workspace } from "../lib/types";
import { Kbd } from "./ui/kbd";
import { StatusPill, type PillTone } from "./ui/status-pill";

const stateLabel: Record<RunState, string> = {
  idle: "Ready",
  working: "Working",
  "needs-input": "Needs input",
  error: "Error",
  sleeping: "Sleeping",
};

const stateTone: Record<RunState, PillTone> = {
  idle: "ready",
  working: "brand",
  "needs-input": "warning",
  error: "danger",
  sleeping: "faint",
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
  onToggleSidebar,
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
  onToggleSidebar: () => void;
}) {
  return (
    <header
      className={cn(
        "drag flex h-[52px] shrink-0 items-center gap-3 border-b border-border/70 px-4",
        !sidebarOpen && "pl-[calc(var(--mygo-titlebar-inset-left,0px)+16px)]",
      )}
    >
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={t("Toggle sidebar")}
        aria-expanded={sidebarOpen}
        title={t("Toggle sidebar")}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        <PanelLeft size={15} />
      </button>
      <div className="flex min-w-0 items-center gap-1.5 text-label">
        <span className="truncate text-subtle">{workspace?.name ?? t("No project")}</span>
        <ChevronRight size={12} className="shrink-0 text-faint" />
        <span className="truncate font-medium text-fg">{title}</span>
      </div>

      <div className="no-drag ml-auto flex items-center gap-1.5">
        {preview ? (
          <StatusPill tone="neutral" dot={false} className="mr-1">
            {t("Preview")}
          </StatusPill>
        ) : null}
        <StatusPill tone={stateTone[state]} className="mr-1">
          {t(stateLabel[state])}
        </StatusPill>

        {sessionActions}
        <button
          type="button"
          onClick={onPalette}
          className="flex h-7 items-center gap-2 rounded-md border border-border bg-surface px-2 text-label text-subtle transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          title={t("Command palette")}
        >
          <Search size={12} />
          <span className="hidden sm:inline">{t("Commands")}</span>
          <Kbd className="ml-0.5">
            <Command size={9} />K
          </Kbd>
        </button>

        <button
          type="button"
          onClick={onToggleRight}
          className={cn(
            "flex size-7 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
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
