import * as Dialog from "@/components/ui/dialog-compat";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";
import { Field, TextInput } from "@/components/ui/field";
import { useEffect, useId, useState } from "react";

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
  const inputId = useId();

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
        <DialogOverlay />
        <DialogSurface width="sm">
          <DialogHeader
            title={t("Rename session")}
            description={t("The name appears in pi's session selector and PiS.")}
            closeLabel={t("Close rename dialog")}
          />
          <div className="px-5 py-4">
            <Field label={t("Session name")} htmlFor={inputId}>
              <TextInput
                id={inputId}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) void save();
                }}
              />
            </Field>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" size="md">
                  {t("Cancel")}
                </Button>
              </Dialog.Close>
              <Button
                variant="primary"
                size="md"
                disabled={!name.trim() || busy}
                onClick={() => void save()}
              >
                {t("Save")}
              </Button>
            </div>
          </div>
        </DialogSurface>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
