import * as Dialog from "@/components/ui/dialog-compat";
import { DialogHeader, DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";
import { GitBranch, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "../lib/api";
import { t } from "../lib/i18n";
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
        <DialogOverlay />
        <DialogSurface width="md">
          <DialogHeader
            title={t("Session tree")}
            description={t("Pick a point to continue from. The abandoned branch is kept.")}
            closeLabel={t("Close session tree")}
          />

          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-3 py-2">
            {!sessionId ? (
              <div className="px-2 py-10 text-center text-label text-faint">
                {t("Open a session first.")}
              </div>
            ) : !data && !error ? (
              <div className="flex items-center justify-center gap-2 py-16 text-label text-faint">
                <Loader2 size={14} className="animate-spin" />
                {t("Reading the tree…")}
              </div>
            ) : error ? (
              <div className="px-2 py-10 text-center text-label text-danger">{error}</div>
            ) : data && data.tree.length === 0 ? (
              <div className="px-2 py-10 text-center text-label text-faint">
                {t("This session has no entries yet.")}
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
            <label className="flex items-center gap-2 text-label text-subtle">
              <input
                type="checkbox"
                checked={summarize}
                onChange={(e) => setSummarize(e.target.checked)}
                className="size-3.5 accent-[var(--brand)]"
              />
              {t("Summarize the branch I leave")}
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
              className="ml-auto flex h-7 items-center gap-1.5 rounded-md border border-control px-2.5 text-label text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-40"
            >
              <GitBranch size={12} />
              {t("Clone branch")}
            </button>
          </div>
        </DialogSurface>
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
            <span className="text-micro font-medium uppercase tracking-label text-faint">
              {t(
                entry.type === "message"
                  ? (entry.role ?? "message")
                  : entry.type.replaceAll("_", " "),
              )}
            </span>
            {active ? <span className="text-micro text-brand-ink">{t("current")}</span> : null}
            {busy === entry.id ? <Loader2 size={10} className="animate-spin" /> : null}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-label leading-4">{title}</span>
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
  const msg = entry.message as { role?: string; content?: unknown } | undefined;
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
