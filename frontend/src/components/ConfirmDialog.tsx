import * as Dialog from "@/components/ui/dialog-compat";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-strong bg-surface p-4 shadow-2xl outline-none">
          <Dialog.Title className="text-[13.5px] font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-5 text-subtle">
            {message}
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="h-8 rounded-md border border-border px-3 text-[11.5px] text-subtle hover:bg-surface-2 hover:text-fg"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => void onConfirm()}
              className={
                danger
                  ? "h-8 rounded-md bg-danger px-3 text-[11.5px] font-medium text-white hover:opacity-90"
                  : "h-8 rounded-md bg-brand px-3 text-[11.5px] font-medium text-brand-fg hover:opacity-90"
              }
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
