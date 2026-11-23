import { Folder, MessageSquare, Plus, Settings2 } from "lucide-react";

import { cn } from "../lib/cn";
import { relativeTime } from "../lib/format";
import { t } from "../lib/i18n";
import type { Summary } from "../mygo";
import type { ChatSession } from "../store/chat";
import type { Bootstrap, Workspace } from "../lib/types";
import { BrandMark } from "./BrandMark";

export function Sidebar({
  boot,
  selected,
  onSelect,
  onNewChat,
  onOpenProject,
  onSettings,
  recentSessions,
  openSessions,
  activeKey,
  onOpenSummary,
  onSelectOpen,
}: {
  boot: Bootstrap;
  selected: Workspace | null;
  onSelect: (workspace: Workspace) => void;
  onNewChat: () => void;
  onOpenProject: () => void;
  onSettings: () => void;
  recentSessions: Summary[];
  openSessions: ChatSession[];
  activeKey: string | null;
  onOpenSummary: (summary: Summary) => void;
  onSelectOpen: (key: string) => void;
}) {
  const pi = boot.pi;
  const projects = [...boot.recents];
  if (selected && !projects.some((p) => p.path === selected.path)) {
    projects.unshift(selected);
  }
  return (
    <aside className="drag flex w-[var(--sidebar-width)] shrink-0 flex-col border-r border-border bg-surface/60">
      <div className="sidebar-head select-none px-3 pb-2">
        <div className="flex items-center gap-2.5 px-1">
          <BrandMark size={26} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold tracking-[-0.01em]">
              PiS
            </div>
            <div className="truncate text-[10.5px] text-faint">
              {t("desktop coding agent")}
            </div>
          </div>
        </div>
      </div>

      <div className="no-drag px-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border-strong/70 bg-surface text-[12.5px] font-medium shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-colors hover:bg-surface-2"
        >
          <Plus size={15} strokeWidth={2.2} />
          {t("New chat")}
        </button>
      </div>

      <div className="no-drag mt-5 min-h-0 flex-1 overflow-y-auto scroll-thin px-2 pb-3">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
            {t("Projects")}
          </span>
          <button
            type="button"
            onClick={onOpenProject}
            className="rounded p-1 text-faint transition-colors hover:bg-surface-2 hover:text-subtle"
            aria-label={t("Open a project folder")}
            title={t("Open a project folder")}
          >
            <Plus size={13} />
          </button>
        </div>
        {projects.length === 0 ? (
          <button
            type="button"
            onClick={onOpenProject}
            className="mx-1 mt-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-[12px] text-subtle transition-colors hover:border-border-strong hover:text-fg"
          >
            <Folder size={14} />
            {t("Open a project folder")}
          </button>
        ) : (
          <ul className="space-y-0.5">
            {projects.map((ws) => {
              const active = selected?.path === ws.path;
              return (
                <li key={ws.path}>
                  <button
                    type="button"
                    onClick={() => onSelect(ws)}
                    className={cn(
                      "group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                      active
                        ? "bg-surface-3/80 text-fg"
                        : "text-subtle hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Folder
                      size={14}
                      className={cn("mt-0.5 shrink-0", active ? "text-brand" : "text-faint")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">
                        {ws.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10.5px] text-faint">
                        {relativeTime(ws.lastOpened)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 px-2">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
              {t("Chats")}
            </span>
          </div>
          {openSessions.length === 0 && recentSessions.length === 0 ? (
            <div className="rounded-lg px-2 py-2 text-[11px] leading-4 text-faint">
              {selected ? t("No chats yet. Start one above.") : t("Open a project to see its chats.")}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {openSessions.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onSelectOpen(s.key)}
                    className={cn(
                      "group flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                      activeKey === s.key
                        ? "bg-surface-3/80 text-fg"
                        : "text-subtle hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        s.dialogs.length > 0
                          ? "bg-warning pulse-soft"
                          : s.status === "error" || s.status === "exited"
                            ? "bg-danger"
                            : s.streaming
                              ? "bg-brand pulse-soft"
                              : s.status === "loading"
                                ? "bg-warning pulse-soft"
                                : "bg-success/70",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium">
                        {s.name || t("New chat")}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-faint">
                        {s.dialogs.length > 0
                          ? t("Needs input")
                          : s.streaming
                            ? t("Working")
                            : s.status === "loading"
                              ? t("Starting pi…")
                              : s.status === "error" || s.status === "exited"
                                ? t("Stopped")
                                : t("Open")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {recentSessions
                .filter((r) => !openSessions.some((s) => s.path === r.path))
                .map((r) => (
                  <li key={r.path}>
                    <button
                      type="button"
                      onClick={() => onOpenSummary(r)}
                      className="group flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <MessageSquare size={12} className="mt-0.5 shrink-0 text-faint" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px]">{r.title}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-faint">
                          {relativeTime(r.updatedAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      <div className="no-drag border-t border-border/70 px-2 py-2">
        <button
          type="button"
          onClick={onSettings}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11.5px] text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Settings2 size={14} />
          {t("Settings")}
        </button>
        <div className="mt-1 flex items-center gap-2 px-2 py-1.5 text-[10.5px] text-faint">
          <span
            className={cn(
              "size-1.5 rounded-full",
              pi.compatible ? "bg-success" : pi.checking ? "bg-warning pulse-soft" : "bg-danger",
            )}
          />
          <span className="truncate">
            {pi.checking
              ? t("Finding pi…")
              : pi.compatible
                ? `pi ${pi.version}`
                : pi.found
                  ? t("pi version unsupported")
                  : t("pi not found")}
          </span>
        </div>
      </div>
    </aside>
  );
}
