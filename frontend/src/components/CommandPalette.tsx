import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import * as Dialog from "@/components/ui/dialog-compat";
import { cn } from "../lib/cn";

export type PaletteAction = {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  shortcut?: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PaletteAction[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actions.filter(
      (a) =>
        !q ||
        a.label.toLowerCase().includes(q) ||
        a.group.toLowerCase().includes(q),
    );
  }, [actions, query]);

  const groups = useMemo(
    () => [...new Set(filtered.map((a) => a.group))],
    [filtered],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-[18%] z-50 w-[min(560px,calc(100vw-48px))] -translate-x-1/2 overflow-hidden rounded-xl border border-border-strong bg-surface p-0 shadow-2xl outline-none">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
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
                    setSelected((v) => (filtered.length ? (v + 1) % filtered.length : 0));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelected((v) =>
                      filtered.length ? (v - 1 + filtered.length) % filtered.length : 0,
                    );
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const action = filtered[selected];
                    if (action) {
                      onOpenChange(false);
                      action.run();
                    }
                  }
                }}
                placeholder="Search commands, sessions, and settings…"
                className="h-11 w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[9px] text-faint">
                esc
              </kbd>
            </div>
            <div className="max-h-[320px] overflow-y-auto scroll-thin p-1.5">
              {filtered.length === 0 ? (
                <div className="px-3 py-8 text-center text-[12px] text-faint">
                  Nothing found.
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group}>
                    <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                      {group}
                    </div>
                    {filtered
                      .filter((a) => a.group === group)
                      .map(({ id, label, icon: Icon, shortcut, run }) => {
                        const index = filtered.findIndex((a) => a.id === id);
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
                              "flex w-full cursor-default items-center gap-2.5 rounded-md px-2 py-2 text-left text-[12px]",
                              index === selected
                                ? "bg-surface-2 text-fg"
                                : "text-subtle hover:bg-surface-2 hover:text-fg",
                            )}
                          >
                            {Icon ? <Icon size={13} className="shrink-0 text-faint" /> : null}
                            <span className="flex-1 truncate">{label}</span>
                            {shortcut ? (
                              <kbd className="rounded border border-border px-1.5 py-0.5 text-[9px] text-faint">
                                {shortcut}
                              </kbd>
                            ) : null}
                          </button>
                        );
                      })}
                  </div>
                ))
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
