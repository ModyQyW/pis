import { ArrowRight, CircleAlert, HelpCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { t } from "../lib/i18n";
import type { ExtensionDialog, ExtensionUIResponse } from "../lib/pi-types";

export function DialogDock({
  dialog,
  pending,
  onRespond,
  onTimeout,
}: {
  dialog: ExtensionDialog;
  pending: number;
  onRespond: (response: Omit<ExtensionUIResponse, "id">) => void;
  onTimeout?: () => void;
}) {
  const [text, setText] = useState(dialog.prefill ?? "");
  // pi resolves a dialog with a timeout on its own; the dock must not linger.
  const expired = useRef(onTimeout);
  useEffect(() => {
    expired.current = onTimeout;
  }, [onTimeout]);
  useEffect(() => {
    if (!dialog.timeout) return;
    const timer = setTimeout(() => expired.current?.(), dialog.timeout);
    return () => clearTimeout(timer);
  }, [dialog.id, dialog.timeout]);
  const options = (dialog.options ?? []).filter(
    (option) => !/type something\.?$/i.test(option.trim()),
  );
  const approval =
    options.some((option) => /^allow once$/i.test(option.trim())) &&
    options.some((option) => /^deny$/i.test(option.trim()));

  const submitText = () => {
    if (text.trim()) onRespond({ value: text });
  };

  return (
    <div className="mx-auto w-full max-w-chat px-5 pb-2">
      <div className="overflow-hidden rounded-xl border border-brand/30 bg-surface shadow-float">
        <div className="flex items-start gap-2.5 border-b border-border/70 bg-brand-soft/40 px-3.5 py-2.5">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-surface text-brand-ink">
            {dialog.method === "confirm" ? <CircleAlert size={11} /> : <HelpCircle size={11} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-label font-medium text-brand-ink">
                {dialog.method === "confirm"
                  ? t("Approval needed")
                  : dialog.method === "select"
                    ? t("Choose an answer")
                    : dialog.method === "editor"
                      ? t("Edit text")
                      : t("Input needed")}
              </span>
              {pending > 1 ? (
                <span className="rounded-full border border-brand/25 px-1.5 py-0.5 text-micro text-brand-ink">
                  {t("1 of {count}", { count: pending })}
                </span>
              ) : null}
            </div>
            {dialog.title ? (
              <div className="mt-1 whitespace-pre-wrap text-label font-medium leading-5">
                {dialog.title}
              </div>
            ) : null}
            {dialog.message ? (
              <div className="mt-1 whitespace-pre-wrap text-label leading-5 text-subtle">
                {dialog.message}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onRespond({ cancelled: true })}
            className="flex size-6 shrink-0 items-center justify-center rounded text-faint hover:bg-surface-2 hover:text-fg"
            aria-label={t("Cancel request")}
            title={t("Cancel")}
          >
            <X size={13} />
          </button>
        </div>

        <div className="px-3.5 py-2.5">
          {dialog.method === "confirm" ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onRespond({ confirmed: false })}
                className="h-8 rounded-md border border-control px-3 text-label text-subtle hover:bg-surface-2 hover:text-fg"
              >
                {t("Deny")}
              </button>
              <button
                type="button"
                onClick={() => onRespond({ confirmed: true })}
                className="h-8 rounded-md bg-primary px-3 text-label font-medium text-primary-foreground hover:opacity-90"
              >
                {t("Allow")}
              </button>
            </div>
          ) : dialog.method === "select" ? (
            <div>
              <div className="max-h-[260px] space-y-1 overflow-y-auto scroll-thin">
                {options.map((option, i) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onRespond({ value: option })}
                    className="flex w-full items-start gap-2 rounded-md border border-border/70 bg-canvas px-2.5 py-2 text-left text-label leading-5 transition-colors hover:border-border-strong hover:bg-surface-2"
                  >
                    <span className="mt-0.5 w-4 shrink-0 text-right text-micro tabular-nums text-faint">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap">{option}</span>
                    <ArrowRight size={11} className="mt-1 shrink-0 text-faint" />
                  </button>
                ))}
              </div>
              {!approval ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) submitText();
                    }}
                    placeholder={t("Or type your own answer…")}
                    className="h-8 min-w-0 flex-1 rounded-md border border-control bg-canvas px-2.5 text-label outline-none placeholder:text-faint focus:border-brand"
                  />
                  <button
                    type="button"
                    disabled={!text.trim()}
                    onClick={submitText}
                    className="h-8 rounded-md border border-control px-3 text-label text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                  >
                    {t("Send")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submitText();
                  }
                }}
                placeholder={dialog.placeholder ?? ""}
                rows={dialog.method === "editor" ? 6 : 3}
                autoFocus
                className="w-full resize-y rounded-md border border-control bg-canvas px-2.5 py-2 text-label leading-5 outline-none placeholder:text-faint focus:border-brand"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <span className="mr-auto text-micro text-faint">{t("⌘Enter to send")}</span>
                <button
                  type="button"
                  disabled={!text.trim()}
                  onClick={submitText}
                  className="h-8 rounded-md bg-primary px-3 text-label font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  {t("Send")}
                </button>
              </div>
            </div>
          )}
          {dialog.timeout ? (
            <p className="mt-2 text-micro text-faint">
              {t("This request may resolve automatically after {seconds}s.", {
                seconds: Math.round(dialog.timeout / 1000),
              })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
