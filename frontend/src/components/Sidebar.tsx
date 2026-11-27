import {
  ChevronDown,
  ChevronRight,
  Folder,
  ListChecks,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { relativeTime } from "../lib/format";
import { pruneSelection } from "../lib/session-selection";
import { t } from "../lib/i18n";
import type { Summary } from "../mygo";
import type { ChatSession } from "../store/chat";
import type { Bootstrap, Workspace } from "../lib/types";
import { BrandMark } from "./BrandMark";
import { Checkbox } from "./ui/checkbox";
import { SectionLabel } from "./ui/section-label";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type SidebarChat = {
  key: string;
  path?: string;
  title: string;
  meta: string;
  leading: ReactNode;
  active: boolean;
  liveKey?: string;
  summary?: Summary;
};

export function Sidebar({
  boot,
  selected,
  onSelect,
  onNewChat,
  onOpenProject,
  onSettings,
  projectSessions,
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
  projectSessions: Record<string, Summary[]>;
  openSessions: ChatSession[];
  activeKey: string | null;
  onOpenSummary: (summary: Summary) => void;
  onSelectOpen: (key: string) => void;
  onDeleteSession: (path: string) => void;
  onDeleteSessions: (paths: string[]) => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const term = query.trim().toLowerCase();

  const projects = useMemo(() => {
    const list = [...boot.recents];
    const known = new Set(list.map((project) => project.path));
    for (const session of openSessions) {
      if (!session.cwd || known.has(session.cwd)) continue;
      known.add(session.cwd);
      list.push({
        path: session.cwd,
        name: session.cwd.split("/").pop() ?? session.cwd,
        lastOpened: new Date().toISOString(),
      });
    }
    if (selected && !known.has(selected.path)) list.unshift(selected);
    return list;
  }, [boot.recents, openSessions, selected]);

  const nodes = useMemo(
    () =>
      projects.map((project) => {
        const live = openSessions.filter((session) => session.cwd === project.path);
        const livePaths = new Set(live.map((session) => session.path).filter(Boolean));
        const chats: SidebarChat[] = [
          ...live.map((session) => ({
            key: session.key,
            path: session.path,
            title: session.name || t("New chat"),
            meta:
              session.dialogs.length > 0
                ? t("Needs input")
                : session.streaming
                  ? t("Working")
                  : session.status === "loading"
                    ? t("Starting pi…")
                    : session.status === "error" || session.status === "exited"
                      ? t("Stopped")
                      : t("Open"),
            leading: (
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  session.dialogs.length > 0
                    ? "bg-warning pulse-soft"
                    : session.status === "error" || session.status === "exited"
                      ? "bg-danger"
                      : session.streaming
                        ? "bg-brand pulse-soft"
                        : session.status === "loading"
                          ? "bg-warning pulse-soft"
                          : "bg-success/70",
                )}
              />
            ),
            active: activeKey === session.key,
            liveKey: session.key,
          })),
          ...(projectSessions[project.path] ?? [])
            .filter((summary) => !livePaths.has(summary.path))
            .map((summary) => ({
              key: summary.path,
              path: summary.path,
              title: summary.title,
              meta: relativeTime(summary.updatedAt),
              leading: <MessageSquare size={12} className="shrink-0 text-faint" />,
              active: false,
              summary,
            })),
        ];
        return { project, chats };
      }),
    [activeKey, openSessions, projectSessions, projects],
  );

  const visibleNodes = useMemo(() => {
    if (!term) return nodes;
    return nodes.flatMap((node) => {
      const projectMatch = `${node.project.name} ${node.project.path}`.toLowerCase().includes(term);
      const chats = projectMatch
        ? node.chats
        : node.chats.filter((chat) => chat.title.toLowerCase().includes(term));
      return projectMatch || chats.length > 0 ? [{ ...node, chats }] : [];
    });
  }, [nodes, term]);

  const allPaths = useMemo(
    () => nodes.flatMap((node) => node.chats.map((chat) => chat.path)).filter(Boolean),
    [nodes],
  );
  const hasChats = allPaths.length > 0;
  const openCwds = useMemo(
    () =>
      openSessions
        .map((session) => session.cwd)
        .sort()
        .join("\n"),
    [openSessions],
  );

  useEffect(() => {
    setSelecting(false);
    setSelectedChats(new Set());
  }, [selected?.path]);
  useEffect(() => {
    setSelectedChats((current) => pruneSelection(current, allPaths));
  }, [allPaths]);
  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      if (selected?.path) next.add(selected.path);
      for (const cwd of openCwds.split("\n")) if (cwd) next.add(cwd);
      return next;
    });
  }, [selected?.path, openCwds]);

  const toggleSelected = (path?: string) => {
    if (!path) return;
    setSelectedChats((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const toggleExpanded = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const pi = boot.pi;

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

      <div className="no-drag mt-4 min-h-0 flex-1 overflow-y-auto scroll-thin px-2 pb-3">
        <div className="relative px-2 pb-2">
          <Search
            size={13}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search projects and chats…")}
            aria-label={t("Search projects and chats…")}
            className="h-8 w-full rounded-md border border-control bg-canvas pl-7 pr-7 text-label outline-none placeholder:text-faint focus:border-brand"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("Clear search")}
              className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-faint hover:bg-surface-2 hover:text-fg"
            >
              <X size={11} />
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-between px-2 pb-1.5">
          <SectionLabel>{t("Projects")}</SectionLabel>
          <div className="flex items-center gap-0.5">
            {selecting ? (
              <>
                <Tooltip>
                  <TooltipTrigger
                    onClick={() => {
                      setSelecting(false);
                      setSelectedChats(new Set());
                    }}
                    className="flex size-6 items-center justify-center rounded-md text-faint hover:bg-surface-2 hover:text-subtle"
                    aria-label={t("Cancel selection")}
                  >
                    <X size={12} />
                  </TooltipTrigger>
                  <TooltipContent>{t("Cancel selection")}</TooltipContent>
                </Tooltip>
                <button
                  type="button"
                  disabled={selectedChats.size === 0}
                  onClick={() => onDeleteSessions([...selectedChats])}
                  aria-label={t("Delete selected chats")}
                  className="flex h-6 items-center gap-1 rounded-md px-1.5 text-micro text-danger hover:bg-danger/10 disabled:opacity-40"
                >
                  <Trash2 size={11} />
                  {t("Delete")}
                  {selectedChats.size > 0 ? ` ${selectedChats.size}` : ""}
                </button>
              </>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger
                    onClick={onOpenProject}
                    className="rounded p-1 text-faint transition-colors hover:bg-surface-2 hover:text-subtle"
                    aria-label={t("Open a project folder")}
                  >
                    <Plus size={13} />
                  </TooltipTrigger>
                  <TooltipContent>{t("Open a project folder")}</TooltipContent>
                </Tooltip>
                {hasChats ? (
                  <Tooltip>
                    <TooltipTrigger
                      onClick={() => {
                        setSelectedChats(new Set());
                        setSelecting(true);
                      }}
                      className="flex size-6 items-center justify-center rounded-md text-faint hover:bg-surface-2 hover:text-subtle"
                      aria-label={t("Select chats")}
                    >
                      <ListChecks size={12} />
                    </TooltipTrigger>
                    <TooltipContent>{t("Select chats")}</TooltipContent>
                  </Tooltip>
                ) : null}
              </>
            )}
          </div>
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
        ) : visibleNodes.length === 0 ? (
          <div className="rounded-lg px-2 py-2 text-label leading-4 text-faint">
            {t("No projects or chats match.")}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {visibleNodes.map(({ project, chats }) => {
              const active = selected?.path === project.path;
              const isOpen = term ? true : expanded.has(project.path);
              return (
                <li key={project.path}>
                  <div
                    className={cn(
                      "group flex items-center gap-0.5 rounded-lg pr-1 transition-colors",
                      active ? "bg-surface-3/80 text-fg" : "hover:bg-surface-2",
                    )}
                  >
                    {term ? (
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-faint/60"
                        aria-hidden="true"
                      >
                        <ChevronDown size={12} />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(project.path)}
                        aria-label={isOpen ? t("Collapse project") : t("Expand project")}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-faint hover:text-fg"
                      >
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(project);
                        if (!isOpen) toggleExpanded(project.path);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                    >
                      <Folder
                        size={14}
                        className={cn("shrink-0", active ? "text-brand-ink" : "text-faint")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-label font-medium">
                          {project.name}
                        </span>
                        <span className="mt-0.5 block truncate text-micro text-faint">
                          {relativeTime(project.lastOpened)}
                        </span>
                      </span>
                    </button>
                  </div>
                  {isOpen ? (
                    <div className="ml-3 border-l border-border/70 pl-1.5">
                      {chats.length === 0 ? (
                        <p className="px-2 py-1.5 text-micro leading-4 text-faint">
                          {t("No chats yet. Start one above.")}
                        </p>
                      ) : (
                        <ul className="space-y-0.5 py-0.5">
                          {chats.map((chat) => (
                            <ChatRow
                              key={chat.key}
                              id={chat.path}
                              title={chat.title}
                              meta={chat.meta}
                              leading={chat.leading}
                              active={chat.active}
                              selecting={selecting}
                              selected={Boolean(chat.path && selectedChats.has(chat.path))}
                              onOpen={() =>
                                chat.liveKey
                                  ? onSelectOpen(chat.liveKey)
                                  : chat.summary
                                    ? onOpenSummary(chat.summary)
                                    : undefined
                              }
                              onToggle={() => toggleSelected(chat.path)}
                              onDelete={() => chat.path && onDeleteSession(chat.path)}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
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
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="ml-1"
          ariaLabel={t("Select {name}", { name: title })}
        />
      ) : null}
      <button
        type="button"
        onClick={selecting ? onToggle : onOpen}
        disabled={selecting && !id}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors disabled:opacity-50",
          active
            ? "bg-surface-3/80 text-fg"
            : selected
              ? "bg-brand-soft/30 text-fg"
              : "text-subtle hover:bg-surface-2 hover:text-fg",
        )}
      >
        <span className="flex h-5 w-3 shrink-0 items-center justify-center">{leading}</span>
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
        <Tooltip>
          <TooltipTrigger
            onClick={onDelete}
            className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-faint opacity-60 transition-opacity hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            aria-label={t("Delete {name}", { name: title })}
          >
            <Trash2 size={11} />
          </TooltipTrigger>
          <TooltipContent>{t("Delete chat")}</TooltipContent>
        </Tooltip>
      ) : null}
    </li>
  );
}
