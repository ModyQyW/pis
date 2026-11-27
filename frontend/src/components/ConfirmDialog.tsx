import * as Dialog from "@/components/ui/dialog-compat";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { DialogHeader, DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";

import { t } from "../lib/i18n";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  danger,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogSurface width="sm">
          <DialogHeader title={title} closeLabel={t("Close")} />
          <div className="px-5 py-4">
            <Dialog.Description className="whitespace-pre-wrap text-label leading-5 text-subtle">
              {message}
            </Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" size="md" disabled={busy}>
                  {t("Cancel")}
                </Button>
              </Dialog.Close>
              <Button
                variant={danger ? "destructive" : "primary"}
                size="md"
                disabled={busy}
                onClick={() => void onConfirm()}
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : null}
                {confirmLabel ?? t("Confirm")}
              </Button>
            </div>
          </div>
        </DialogSurface>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
