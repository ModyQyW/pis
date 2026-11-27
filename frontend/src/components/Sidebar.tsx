import { Folder, ListChecks, MessageSquare, Plus, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { relativeTime } from "../lib/format";
import { pruneSelection } from "../lib/session-selection";
import { t } from "../lib/i18n";
import type { Summary } from "../mygo";
import type { ChatSession } from "../store/chat";
import type { Bootstrap, Workspace } from "../lib/types";
import { BrandMark } from "./BrandMark";
import { SectionLabel } from "./ui/section-label";

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
  onDeleteSession,
  onDeleteSessions,
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
  onDeleteSession: (path: string) => void;
  onDeleteSessions: (paths: string[]) => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelecting(false);
    setSelectedChats(new Set());
  }, [selected?.path]);
  useEffect(() => {
    setSelectedChats((current) =>
      pruneSelection(current, [
        ...openSessions.map((session) => session.path),
        ...recentSessions.map((session) => session.path),
      ]),
    );
  }, [openSessions, recentSessions]);
  const toggleSelected = (path?: string) => {
    if (!path) return;
    setSelectedChats((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const pi = boot.pi;
  const hasChats = openSessions.length > 0 || recentSessions.length > 0;
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
            <div className="truncate text-body font-semibold tracking-[-0.01em]">PiS</div>
            <div className="truncate text-micro text-faint">{t("desktop coding agent")}</div>
          </div>
        </div>
      </div>

      <div className="no-drag px-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border-strong/70 bg-surface text-label font-medium transition-colors hover:bg-surface-2"
        >
          <Plus size={15} strokeWidth={2.2} />
          {t("New chat")}
        </button>
      </div>

      <div className="no-drag mt-5 min-h-0 flex-1 overflow-y-auto scroll-thin px-2 pb-3">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <SectionLabel>{t("Projects")}</SectionLabel>
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
            className="mx-1 mt-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-label text-subtle transition-colors hover:border-border-strong hover:text-fg"
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
                      className={cn("mt-0.5 shrink-0", active ? "text-brand-ink" : "text-faint")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label font-medium">{ws.name}</span>
                      <span className="mt-0.5 block truncate text-micro text-faint">
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
            <SectionLabel>{t("Chats")}</SectionLabel>
            {hasChats ? (
              <div className="flex items-center gap-0.5">
                {selecting ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelecting(false);
                        setSelectedChats(new Set());
                      }}
                      className="flex size-6 items-center justify-center rounded-md text-faint hover:bg-surface-2 hover:text-subtle"
                      aria-label={t("Cancel selection")}
                      title={t("Cancel selection")}
                    >
                      <X size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={selectedChats.size === 0}
                      onClick={() => onDeleteSessions([...selectedChats])}
                      aria-label={t("Delete selected chats")}
                      title={t("Delete selected chats")}
                      className="flex h-6 items-center gap-1 rounded-md px-1.5 text-micro text-danger hover:bg-danger/10 disabled:opacity-40"
                    >
                      <Trash2 size={11} />
                      {t("Delete")}
                      {selectedChats.size > 0 ? ` ${selectedChats.size}` : ""}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChats(new Set());
                      setSelecting(true);
                    }}
                    className="flex size-6 items-center justify-center rounded-md text-faint hover:bg-surface-2 hover:text-subtle"
                    aria-label={t("Select chats")}
                    title={t("Select chats")}
                  >
                    <ListChecks size={12} />
                  </button>
                )}
              </div>
            ) : null}
          </div>
          {openSessions.length === 0 && recentSessions.length === 0 ? (
            <div className="rounded-lg px-2 py-2 text-label leading-4 text-faint">
              {selected
                ? t("No chats yet. Start one above.")
                : t("Open a project to see its chats.")}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {openSessions.map((s) => (
                <ChatRow
                  key={s.key}
                  id={s.path}
                  title={s.name || t("New chat")}
                  meta={
                    s.dialogs.length > 0
                      ? t("Needs input")
                      : s.streaming
                        ? t("Working")
                        : s.status === "loading"
                          ? t("Starting pi…")
                          : s.status === "error" || s.status === "exited"
                            ? t("Stopped")
                            : t("Open")
                  }
                  leading={
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
                  }
                  active={activeKey === s.key}
                  selecting={selecting}
                  selected={Boolean(s.path && selectedChats.has(s.path))}
                  onOpen={() => onSelectOpen(s.key)}
                  onToggle={() => toggleSelected(s.path)}
                  onDelete={() => s.path && onDeleteSession(s.path)}
                />
              ))}
              {recentSessions
                .filter((r) => !openSessions.some((s) => s.path === r.path))
                .map((r) => (
                  <ChatRow
                    key={r.path}
                    id={r.path}
                    title={r.title}
                    meta={relativeTime(r.updatedAt)}
                    leading={<MessageSquare size={12} className="mt-0.5 shrink-0 text-faint" />}
                    active={false}
                    selecting={selecting}
                    selected={selectedChats.has(r.path)}
                    onOpen={() => onOpenSummary(r)}
                    onToggle={() => toggleSelected(r.path)}
                    onDelete={() => onDeleteSession(r.path)}
                  />
                ))}
            </ul>
          )}
        </div>
      </div>

      <div className="no-drag border-t border-border/70 px-2 py-2">
        <button
          type="button"
          onClick={onSettings}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-label text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Settings2 size={14} />
          {t("Settings")}
        </button>
        <div className="mt-1 flex items-center gap-2 px-2 py-1.5 text-micro text-faint">
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

function ChatRow({
  id,
  title,
  meta,
  leading,
  active,
  selecting,
  selected,
  onOpen,
  onToggle,
  onDelete,
}: {
  id?: string;
  title: string;
  meta: string;
  leading: ReactNode;
  active: boolean;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group flex items-center gap-1">
      {selecting && id ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="ml-1 size-3.5 shrink-0 accent-[var(--brand)]"
          aria-label={t("Select {name}", { name: title })}
          title={t("Select {name}", { name: title })}
        />
      ) : null}
      <button
        type="button"
        onClick={selecting ? onToggle : onOpen}
        disabled={selecting && !id}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors disabled:opacity-50",
          active
            ? "bg-surface-3/80 text-fg"
            : selected
              ? "bg-brand-soft/30 text-fg"
              : "text-subtle hover:bg-surface-2 hover:text-fg",
        )}
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label font-medium">{title}</span>
          <span
            className={cn(
              "mt-0.5 block truncate text-micro",
              active || selected ? "text-subtle" : "text-faint",
            )}
          >
            {meta}
          </span>
        </span>
      </button>
      {!selecting && id ? (
        <button
          type="button"
          onClick={onDelete}
          className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-faint opacity-60 transition-opacity hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label={t("Delete {name}", { name: title })}
          title={t("Delete chat")}
        >
          <Trash2 size={11} />
        </button>
      ) : null}
    </li>
  );
}
