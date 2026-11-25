import * as Dialog from "@/components/ui/dialog-compat";
import { Clipboard, FolderOpen, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { toast } from "../lib/toast";

import { api } from "../lib/api";
import { DiffView } from "./DiffView";

export function DiffDialog({
  open,
  onOpenChange,
  workspace,
  path,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: string;
  path: string;
}) {
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setDiff("");
    api
      .gitDiff(workspace, path)
      .then((d) => {
        if (alive) setDiff(d);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, workspace, path]);

  const fullPath = `${workspace.replace(/\/$/, "")}/${path}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(820px,calc(100vh-64px))] w-[min(900px,calc(100vw-64px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border-strong bg-surface shadow-2xl outline-none">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate font-mono text-[12px] font-medium">
                {path}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[10px] text-faint">
                {t("Working tree diff against HEAD")}
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(diff);
                  toast.success(t("Patch copied"));
                } catch {
                  toast.error(t("Could not copy the patch"));
                }
              }}
              className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[10.5px] text-subtle hover:bg-surface-2 hover:text-fg"
            >
              <Clipboard size={11} />
              {t("Copy patch")}
            </button>
            <button
              type="button"
              onClick={() => void api.reveal(fullPath)}
              className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[10.5px] text-subtle hover:bg-surface-2 hover:text-fg"
            >
              <FolderOpen size={11} />
              {t("Reveal")}
            </button>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
                aria-label={t("Close diff")}
              >
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto scroll-thin p-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[11.5px] text-faint">
                <Loader2 size={14} className="animate-spin" />
                {t("Reading diff…")}
              </div>
            ) : error ? (
              <div className="px-3 py-12 text-center text-[11.5px] text-danger">{error}</div>
            ) : diff.trim() ? (
              <DiffView diff={diff} />
            ) : (
              <div className="px-3 py-12 text-center text-[11.5px] text-faint">
                {t("No textual diff for this file.")}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
