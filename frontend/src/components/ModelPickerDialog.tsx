import * as Dialog from "@/components/ui/dialog-compat";
import { Check, RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "../lib/cn";
import { t } from "../lib/i18n";
import type { Model } from "../mygo";
import type { ChatSession } from "../store/chat";

export function ModelPickerDialog({
  open,
  onOpenChange,
  session,
  onChooseModel,
  onChooseThinking,
  onToggleAutoCompaction,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ChatSession | null;
  onChooseModel: (model: Model) => Promise<void>;
  onChooseThinking: (level: string) => Promise<void>;
  onToggleAutoCompaction: (enabled: boolean) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const models = (session?.models ?? []).filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q),
    );
    const groups = new Map<string, Model[]>();
    for (const m of models) {
      const list = groups.get(m.provider) ?? [];
      list.push(m);
      groups.set(m.provider, list);
    }
    return [...groups.entries()];
  }, [session?.models, query]);

  const choose = async (model: Model) => {
    setBusy(model.id);
    try {
      await onChooseModel(model);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(700px,calc(100vh-64px))] w-[min(620px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border-strong bg-surface shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <Dialog.Title className="text-[13.5px] font-semibold">
                {t("Model & thinking")}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[10.5px] text-faint">
                {t("Models come from your pi credentials and configuration.")}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
                aria-label={t("Close model picker")}
              >
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={13} className="text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search models…")}
              className="h-9 min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-faint"
            />
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="flex size-6 items-center justify-center rounded text-faint hover:bg-surface-2 hover:text-fg"
              aria-label={t("Refresh models")}
              title={t("Refresh models")}
            >
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-2 py-1.5">
            {grouped.length === 0 ? (
              <div className="px-4 py-12 text-center text-[11.5px] leading-5 text-faint">
                {t("No models available. Sign in with pi or configure a provider, then refresh.")}
              </div>
            ) : (
              grouped.map(([provider, models]) => (
                <div key={provider} className="mb-1">
                  <div className="px-2 pb-1 pt-2 text-[9.5px] font-medium uppercase tracking-[0.08em] text-faint">
                    {provider}
                  </div>
                  {models.map((model) => {
                    const active =
                      session?.model?.id === model.id && session.model?.provider === provider;
                    return (
                      <button
                        key={`${provider}/${model.id}`}
                        type="button"
                        onClick={() => void choose(model)}
                        disabled={busy !== null}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors disabled:opacity-60",
                          active ? "bg-brand-soft/60 text-fg" : "text-subtle hover:bg-surface-2 hover:text-fg",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium">{model.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-faint">
                            {model.id}
                            {model.contextWindow ? ` · ${Math.round(model.contextWindow / 1000)}k context` : ""}
                          </span>
                        </span>
                        {busy === model.id ? (
                          <RefreshCw size={12} className="animate-spin text-subtle" />
                        ) : active ? (
                          <Check size={13} className="text-brand" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                {t("Thinking")}
              </span>
              <div className="flex gap-1">
                {(session?.thinkingLevels.length
                  ? session.thinkingLevels
                  : ["off", "low", "medium", "high"]
                ).map((level) => (
                  <button
                    key={level}
                    type="button"
                    disabled={!session?.model?.reasoning}
                    onClick={() => void onChooseThinking(level)}
                    className={cn(
                      "h-6 rounded-md border px-2 text-[10px] capitalize transition-colors disabled:opacity-40",
                      session?.thinking === level
                        ? "border-brand/35 bg-brand-soft text-brand"
                        : "border-border text-subtle hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <label className="ml-auto flex items-center gap-1.5 text-[10.5px] text-subtle">
                <input
                  type="checkbox"
                  checked={session?.autoCompaction ?? true}
                  onChange={(e) => void onToggleAutoCompaction(e.target.checked)}
                  className="size-3.5 accent-[var(--brand)]"
                />
                {t("Auto-compact")}
              </label>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
