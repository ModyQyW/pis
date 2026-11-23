import * as Dialog from "@/components/ui/dialog-compat";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { t } from "../lib/i18n";

export function RenameDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSave(name);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-strong bg-surface p-4 shadow-2xl outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-[13.5px] font-semibold">{t("Rename session")}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex size-6 items-center justify-center rounded text-subtle hover:bg-surface-2 hover:text-fg"
                aria-label={t("Close rename dialog")}
              >
                <X size={13} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-[10.5px] text-faint">
            {t("The name appears in pi's session selector and PiS.")}
          </Dialog.Description>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void save();
            }}
            className="mt-3 h-8 w-full rounded-md border border-border bg-canvas px-2.5 text-[12px] outline-none focus:border-border-strong"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="h-7 rounded-md border border-border px-2.5 text-[11px] text-subtle hover:bg-surface-2 hover:text-fg"
              >
                {t("Cancel")}
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={!name.trim() || busy}
              onClick={() => void save()}
              className="h-7 rounded-md bg-brand px-3 text-[11px] font-medium text-brand-fg hover:opacity-90 disabled:opacity-40"
            >
              {t("Save")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
