import * as Dialog from "@/components/ui/dialog-compat";
import { GitBranch, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { cn } from "../lib/cn";
import type { Entry } from "../mygo";

type Node = {
  entry: Entry;
  children: Node[];
  label?: string;
};

type TreeData = { tree: Node[]; leafId: string | null };

export function SessionTreeDialog({
  open,
  onOpenChange,
  sessionId,
  onNavigate,
  onClone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
  onNavigate: (entryId: string, summarize: boolean) => Promise<void>;
  onClone: () => Promise<void>;
}) {
  const [data, setData] = useState<TreeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summarize, setSummarize] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sessionId) return;
    let alive = true;
    setData(null);
    setError(null);
    api
      .getTree(sessionId)
      .then((raw) => {
        if (alive) setData(raw as TreeData);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [open, sessionId]);

  const navigate = async (id: string) => {
    setBusy(id);
    try {
      await onNavigate(id, summarize);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(680px,calc(100vh-80px))] w-[min(640px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border-strong bg-surface shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <Dialog.Title className="text-[13.5px] font-semibold">Session tree</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[10.5px] text-faint">
                Pick a point to continue from. The abandoned branch is kept.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
                aria-label="Close session tree"
              >
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-3 py-2">
            {!sessionId ? (
              <div className="px-2 py-10 text-center text-[11.5px] text-faint">
                Open a session first.
              </div>
            ) : !data && !error ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[11.5px] text-faint">
                <Loader2 size={14} className="animate-spin" />
                Reading the tree…
              </div>
            ) : error ? (
              <div className="px-2 py-10 text-center text-[11.5px] text-danger">{error}</div>
            ) : data && data.tree.length === 0 ? (
              <div className="px-2 py-10 text-center text-[11.5px] text-faint">
                This session has no entries yet.
              </div>
            ) : (
              data?.tree.map((node) => (
                <TreeNode
                  key={node.entry.id}
                  node={node}
                  depth={0}
                  leafId={data.leafId}
                  busy={busy}
                  onPick={navigate}
                />
              ))
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-border px-4 py-2.5">
            <label className="flex items-center gap-2 text-[11px] text-subtle">
              <input
                type="checkbox"
                checked={summarize}
                onChange={(e) => setSummarize(e.target.checked)}
                className="size-3.5 accent-[var(--brand)]"
              />
              Summarize the branch I leave
            </label>
            <button
              type="button"
              onClick={async () => {
                setBusy("clone");
                try {
                  await onClone();
                  onOpenChange(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy !== null}
              className="ml-auto flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-40"
            >
              <GitBranch size={12} />
              Clone branch
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TreeNode({
  node,
  depth,
  leafId,
  busy,
  onPick,
}: {
  node: Node;
  depth: number;
  leafId: string | null;
  busy: string | null;
  onPick: (id: string) => void;
}) {
  const entry = node.entry;
  const active = leafId === entry.id;
  const title = entryTitle(entry);
  return (
    <div>
      <button
        type="button"
        onClick={() => onPick(entry.id)}
        disabled={busy !== null}
        className={cn(
          "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors disabled:opacity-60",
          active ? "bg-brand-soft/60 text-fg" : "text-subtle hover:bg-surface-2 hover:text-fg",
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <span
          className={cn(
            "mt-1 size-1.5 shrink-0 rounded-full",
            active ? "bg-brand" : "bg-border-strong",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[9.5px] font-medium uppercase tracking-[0.06em] text-faint">
              {entry.type === "message" ? entry.role ?? "message" : entry.type.replace("_", " ")}
            </span>
            {active ? <span className="text-[9px] text-brand">current</span> : null}
            {busy === entry.id ? <Loader2 size={10} className="animate-spin" /> : null}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4">{title}</span>
        </span>
      </button>
      {node.children.map((child) => (
        <TreeNode
          key={child.entry.id}
          node={child}
          depth={depth + 1}
          leafId={leafId}
          busy={busy}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

function entryTitle(entry: Entry): string {
  if (entry.summary) return entry.summary;
  const msg = entry.message as
    | { role?: string; content?: unknown }
    | undefined;
  if (!msg) return entry.type;
  if (typeof msg.content === "string") return msg.content.slice(0, 160);
  if (Array.isArray(msg.content)) {
    const parts: string[] = [];
    for (const block of msg.content as Array<{ type?: string; text?: string; thinking?: string }>) {
      if (block.type === "text" && block.text) parts.push(block.text);
      if (block.type === "thinking" && block.thinking) parts.push(`[thinking] ${block.thinking}`);
      if (block.type === "toolCall") parts.push("[tool call]");
    }
    return parts.join(" ").slice(0, 160) || entry.type;
  }
  return entry.type;
}
