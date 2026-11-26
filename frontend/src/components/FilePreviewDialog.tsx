import * as Dialog from "@/components/ui/dialog-compat";
import { DialogHeader, DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Clipboard, FolderOpen, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { toast } from "../lib/toast";

import { api } from "../lib/api";

export function FilePreviewDialog({
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
  const [text, setText] = useState("");
  const [meta, setMeta] = useState<{ truncated: boolean; binary: boolean; size: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .readFile(workspace, path)
      .then((v) => {
        if (!alive) return;
        setText(v.text);
        setMeta({ truncated: v.truncated, binary: v.binary, size: v.size });
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
            description={`${t("Read-only preview")}${meta?.truncated ? ` · ${t("truncated")}` : ""}`}
            closeLabel={t("Close preview")}
            actions={
              <>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(text);
                      toast.success(t("File contents copied"));
                    } catch {
                      toast.error(t("Could not copy"));
                    }
                  }}
                >
                  <Clipboard size={11} />
                  {t("Copy")}
                </Button>
                <Button variant="outline" size="xs" onClick={() => void api.reveal(fullPath)}>
                  <FolderOpen size={11} />
                  {t("Open")}
                </Button>
              </>
            }
          />
          <div className="min-h-0 flex-1 overflow-auto scroll-thin p-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-label text-faint">
                <Loader2 size={14} className="animate-spin" />
                {t("Reading file…")}
              </div>
            ) : error ? (
              <div className="px-3 py-12 text-center text-label text-danger">{error}</div>
            ) : meta?.binary ? (
              <div className="px-3 py-12 text-center text-label text-faint">
                {t("Binary file")} · {Math.round((meta.size ?? 0) / 1024)} KB
              </div>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono code-text-dense leading-[1.6] text-subtle">
                {text}
              </pre>
            )}
          </div>
        </DialogSurface>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
