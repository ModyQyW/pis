import * as Dialog from "@/components/ui/dialog-compat";
import { DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { FolderLock, ShieldCheck } from "lucide-react";

import { t } from "../lib/i18n";
import type { Info as TrustInfo } from "../mygo";

export function TrustDialog({
  info,
  open,
  onOpenChange,
  onChoose,
}: {
  info: TrustInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (trusted: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogSurface width="sm" className="block p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand-soft text-brand-ink">
              <FolderLock size={17} />
            </span>
            <div className="min-w-0">
              <Dialog.Title className="text-body-lg font-semibold">
                {t("Trust this project?")}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-label leading-5 text-subtle">
                <span className="font-mono text-micro">{info?.path}</span>
              </Dialog.Description>
            </div>
          </div>

          <p className="mt-3 text-label leading-5 text-subtle">
            {t(
              "This folder contains pi resources that can run code or change how the agent behaves. Trusting it lets pi load them for sessions in this project.",
            )}
          </p>

          <div className="mt-3 rounded-lg border border-border bg-canvas p-3">
            <SectionLabel>{t("Resources found")}</SectionLabel>
            <ul className="mt-1.5 space-y-1">
              {(info?.resources ?? []).map((r) => (
                <li key={r} className="flex items-center gap-2 font-mono text-micro text-subtle">
                  <span className="size-1 rounded-full bg-warning" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-3 text-micro leading-4 text-faint">
            {t(
              "The decision is stored by PiS, not written to pi's trust store. Existing sessions keep their current trust until restarted.",
            )}
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onChoose(false)}>
              {t("Don't trust")}
            </Button>
            <Button variant="primary" size="sm" onClick={() => onChoose(true)}>
              <ShieldCheck size={12} />
              {t("Trust project")}
            </Button>
          </div>
        </DialogSurface>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
