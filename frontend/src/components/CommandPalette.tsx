import type { LucideIcon } from "lucide-react";
import { Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import * as Dialog from "@/components/ui/dialog-compat";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { t } from "../lib/i18n";
import type { SearchHit, Summary } from "../mygo";

export type PaletteAction = {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  shortcut?: string;
  detail?: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  actions,
  workspace,
  onOpenSession,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PaletteAction[];
  workspace?: string;
  onOpenSession?: (summary: Summary) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actions.filter(
      (a) => !q || a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q),
    );
  }, [actions, query]);

  const sessionActions = useMemo<PaletteAction[]>(
    () =>
      hits.map((hit) => ({
        id: `session-hit-${hit.id}`,
        label: hit.title,
        group: "Session text",
        icon: Search,
        detail: hit.snippet,
        run: () => onOpenSession?.(hit),
      })),
    [hits, onOpenSession],
  );

  const visible = useMemo(() => [...filtered, ...sessionActions], [filtered, sessionActions]);

  const groups = useMemo(() => [...new Set(visible.map((a) => a.group))], [visible]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setHits([]);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const term = query.trim();
    if (!open || !workspace || term.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .searchSessions(workspace, term, 8)
        .then((next) => {
          if (alive) setHits(next);
        })
        .catch(() => {
          if (alive) setHits([]);
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 180);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, query, workspace]);

  useEffect(() => {
    if (selected >= visible.length) {
      setSelected(Math.max(0, visible.length - 1));
    }
  }, [selected, visible.length]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-[18%] z-50 w-[min(560px,calc(100vw-48px))] -translate-x-1/2 overflow-hidden rounded-xl border border-border-strong bg-surface p-0 shadow-2xl outline-none">
          <Dialog.Title className="sr-only">{t("Command palette")}</Dialog.Title>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search size={14} className="shrink-0 text-faint" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelected((v) => (visible.length ? (v + 1) % visible.length : 0));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelected((v) =>
                      visible.length ? (v - 1 + visible.length) % visible.length : 0,
                    );
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const action = visible[selected];
                    if (action) {
                      onOpenChange(false);
                      action.run();
                    }
                  }
                }}
                placeholder={t("Search commands, sessions, and settings…")}
                className="h-11 w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[9px] text-faint">
                esc
              </kbd>
            </div>
            <div className="max-h-[320px] overflow-y-auto scroll-thin p-1.5">
              {visible.length === 0 && !searching ? (
                <div className="px-3 py-8 text-center text-[12px] text-faint">
                  {t("Nothing found.")}
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group}>
                    <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                      {t(group)}
                    </div>
                    {visible
                      .filter((a) => a.group === group)
                      .map(({ id, label, icon: Icon, shortcut, detail, run }) => {
                        const index = visible.findIndex((a) => a.id === id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onMouseEnter={() => setSelected(index)}
                            onClick={() => {
                              onOpenChange(false);
                              run();
                            }}
                            className={cn(
                              "flex w-full cursor-default items-start gap-2.5 rounded-md px-2 py-2 text-left text-[12px]",
                              index === selected
                                ? "bg-surface-2 text-fg"
                                : "text-subtle hover:bg-surface-2 hover:text-fg",
                            )}
                          >
                            {Icon ? (
                              <Icon size={13} className="mt-0.5 shrink-0 text-faint" />
                            ) : null}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{t(label)}</span>
                              {detail ? (
                                <span className="mt-0.5 block truncate text-[10.5px] text-faint">
                                  {detail}
                                </span>
                              ) : null}
                            </span>
                            {shortcut ? (
                              <kbd className="mt-0.5 rounded border border-border px-1.5 py-0.5 text-[9px] text-faint">
                                {shortcut}
                              </kbd>
                            ) : null}
                          </button>
                        );
                      })}
                  </div>
                ))
              )}
              {searching ? (
                <div className="flex items-center gap-2 px-3 py-2 text-[10.5px] text-faint">
                  <Loader2 size={11} className="animate-spin" />
                  {t("Searching session text…")}
                </div>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
