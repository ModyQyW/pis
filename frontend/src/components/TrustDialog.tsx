import * as Dialog from "@/components/ui/dialog-compat";
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-strong bg-surface p-5 shadow-2xl outline-none">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand-soft text-brand">
              <FolderLock size={17} />
            </span>
            <div className="min-w-0">
              <Dialog.Title className="text-[14px] font-semibold">
                {t("Trust this project?")}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[11.5px] leading-5 text-subtle">
                <span className="font-mono text-[10.5px]">{info?.path}</span>
              </Dialog.Description>
            </div>
          </div>

          <p className="mt-3 text-[11.5px] leading-5 text-subtle">
            {t(
              "This folder contains pi resources that can run code or change how the agent behaves. Trusting it lets pi load them for sessions in this project.",
            )}
          </p>

          <div className="mt-3 rounded-lg border border-border bg-canvas p-3">
            <div className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-faint">
              {t("Resources found")}
            </div>
            <ul className="mt-1.5 space-y-1">
              {(info?.resources ?? []).map((r) => (
                <li key={r} className="flex items-center gap-2 font-mono text-[10.5px] text-subtle">
                  <span className="size-1 rounded-full bg-warning" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-3 text-[10px] leading-4 text-faint">
            {t(
              "The decision is stored by PiS, not written to pi's trust store. Existing sessions keep their current trust until restarted.",
            )}
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onChoose(false)}
              className="h-8 rounded-md border border-border px-3 text-[11.5px] text-subtle hover:bg-surface-2 hover:text-fg"
            >
              {t("Don't trust")}
            </button>
            <button
              type="button"
              onClick={() => onChoose(true)}
              className="flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-[11.5px] font-medium text-brand-fg hover:opacity-90"
            >
              <ShieldCheck size={12} />
              {t("Trust project")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
