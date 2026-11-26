import * as Dialog from "@/components/ui/dialog-compat";
import { DialogHeader, DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Clipboard, FolderOpen, Loader2 } from "lucide-react";
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
        <DialogOverlay />
        <DialogSurface width="xl">
          <DialogHeader
            title={<span className="truncate font-mono">{path}</span>}
            description={t("Working tree diff against HEAD")}
            closeLabel={t("Close diff")}
            actions={
              <>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(diff);
                      toast.success(t("Patch copied"));
                    } catch {
                      toast.error(t("Could not copy the patch"));
                    }
                  }}
                >
                  <Clipboard size={11} />
                  {t("Copy patch")}
                </Button>
                <Button variant="outline" size="xs" onClick={() => void api.reveal(fullPath)}>
                  <FolderOpen size={11} />
                  {t("Reveal")}
                </Button>
              </>
            }
          />
          <div className="min-h-0 flex-1 overflow-auto scroll-thin p-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-label text-faint">
                <Loader2 size={14} className="animate-spin" />
                {t("Reading diff…")}
              </div>
            ) : error ? (
              <div className="px-3 py-12 text-center text-label text-danger">{error}</div>
            ) : diff.trim() ? (
              <DiffView diff={diff} />
            ) : (
              <div className="px-3 py-12 text-center text-label text-faint">
                {t("No textual diff for this file.")}
              </div>
            )}
          </div>
        </DialogSurface>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
