import * as Dialog from "@/components/ui/dialog-compat";
import { CheckboxField } from "@/components/ui/checkbox";
import { DialogHeader, DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";
import { Check, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "../lib/cn";
import { t } from "../lib/i18n";
import { toast } from "../lib/toast";
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
  const [refreshing, setRefreshing] = useState(false);

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
        <DialogOverlay />
        <DialogSurface width="md">
          <DialogHeader
            title={t("Model & thinking")}
            description={t("Models come from your pi credentials and configuration.")}
            closeLabel={t("Close model picker")}
          />

          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={13} className="text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search models…")}
              className="h-9 min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-faint"
            />
            <button
              type="button"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await onRefresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : String(err));
                } finally {
                  setRefreshing(false);
                }
              }}
              className="flex size-6 items-center justify-center rounded text-faint hover:bg-surface-2 hover:text-fg disabled:opacity-50"
              aria-label={t("Refresh models")}
              title={t("Refresh models")}
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-2 py-1.5">
            {grouped.length === 0 ? (
              <div className="px-4 py-12 text-center text-label leading-5 text-faint">
                {t("No models available. Sign in with pi or configure a provider, then refresh.")}
              </div>
            ) : (
              grouped.map(([provider, models]) => (
                <div key={provider} className="mb-1">
                  <div className="px-2 pb-1 pt-2 text-micro font-medium uppercase tracking-label text-faint">
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
                          active
                            ? "bg-brand-soft/60 text-fg"
                            : "text-subtle hover:bg-surface-2 hover:text-fg",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-label font-medium">
                            {model.name}
                          </span>
                          <span className="mt-0.5 block truncate text-micro text-faint">
                            {model.id}
                            {model.contextWindow
                              ? ` · ${Math.round(model.contextWindow / 1000)}k context`
                              : ""}
                          </span>
                        </span>
                        {busy === model.id ? (
                          <RefreshCw size={12} className="animate-spin text-subtle" />
                        ) : active ? (
                          <Check size={13} className="text-brand-ink" />
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
              <span className="text-micro font-medium uppercase tracking-label text-faint">
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
                      "h-6 rounded-md border px-2 text-micro capitalize transition-colors disabled:opacity-40",
                      session?.thinking === level
                        ? "border-brand/35 bg-brand-soft text-brand-ink"
                        : "border-border text-subtle hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {t(level)}
                  </button>
                ))}
              </div>
              <CheckboxField
                checked={session?.autoCompaction ?? true}
                onCheckedChange={(checked) => void onToggleAutoCompaction(checked)}
                className="ml-auto flex items-center gap-1.5 text-micro text-subtle"
                ariaLabel={t("Auto-compact")}
              >
                {t("Auto-compact")}
              </CheckboxField>
            </div>
          </div>
        </DialogSurface>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
