import * as Dialog from "@/components/ui/dialog-compat";
import { DialogHeader, DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";
import { TextInput } from "@/components/ui/field";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { KeyRound, Loader2, LogIn } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t } from "../lib/i18n";
import { toast } from "../lib/toast";

import "@xterm/xterm/css/xterm.css";

import { api } from "../lib/api";
import { cn } from "../lib/cn";

export function LoginDialog({
  open,
  onOpenChange,
  onDone,
  codeFontSize,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  codeFontSize: number;
}) {
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState(false);
  const [authId, setAuthId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [exited, setExited] = useState<{ code: number; error?: string } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const pending = useRef("");
  const openRef = useRef(open);
  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) {
      setAuthId(null);
      setExited(null);
      pending.current = "";
      term.current?.dispose();
      term.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const offOut = api.onAuthOutput((o) => {
      if (o.id !== authId) return;
      if (term.current) term.current.write(o.data);
      else pending.current += o.data;
    });
    const offExit = api.onAuthExit((o) => {
      if (o.id !== authId) return;
      setExited({ code: o.code, error: o.error });
      if (o.code === 0) {
        toast.success(t("Provider connected"));
        onDone();
      } else {
        toast.error(o.error || t("Login did not complete"));
      }
    });
    return () => {
      offOut();
      offExit();
    };
  }, [open, authId, onDone]);

  useEffect(() => {
    if (!open || !authId || !host.current) return;
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;
    const probe = document.createElement("span");
    probe.style.cssText = "position:fixed;display:none;color:var(--brand)";
    document.body.appendChild(probe);
    const cursor = getComputedStyle(probe).color || "#e88a4b";
    probe.remove();
    const t = new Terminal({
      fontFamily: styles.getPropertyValue("--font-mono").trim() || "monospace",
      fontSize: codeFontSize,
      lineHeight: 1.35,
      cursorBlink: true,
      theme: {
        background: token("--term-bg", "#141413"),
        foreground: token("--term-fg", "#edeae3"),
        cursor,
        selectionBackground: token("--term-selection", "#3a2a1d"),
      },
    });
    const f = new FitAddon();
    t.loadAddon(f);
    t.open(host.current);
    f.fit();
    term.current = t;
    fit.current = f;
    if (pending.current) {
      t.write(pending.current);
      pending.current = "";
    }
    const data = t.onData((input) => void api.authWrite(authId, input).catch(() => {}));
    const resize = t.onResize(
      ({ cols, rows }) => void api.authResize(authId, cols, rows).catch(() => {}),
    );
    const ro = new ResizeObserver(() => {
      try {
        f.fit();
      } catch {
        // The host may be hidden while the dialog closes.
      }
    });
    ro.observe(host.current);
    t.focus();
    return () => {
      ro.disconnect();
      data.dispose();
      resize.dispose();
      t.dispose();
      term.current = null;
      fit.current = null;
    };
  }, [open, authId, codeFontSize]);

  const start = async () => {
    if (!provider.trim()) return;
    setStarting(true);
    try {
      const info = await api.startAuth(provider.trim(), apiKey);
      if (!openRef.current) {
        await api.authCancel(info.id).catch(() => {});
        return;
      }
      setAuthId(info.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (authId) await api.authCancel(authId).catch(() => {});
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? onOpenChange(o) : void cancel())}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogSurface width="lg">
          <DialogHeader
            title={t("Connect a provider")}
            description={t("Runs pi's own login. PiS does not store or log credentials.")}
            closeLabel={t("Close login")}
          />

          {!authId ? (
            <div className="px-5 py-5">
              <label htmlFor="login-provider" className="text-label font-medium text-subtle">
                {t("Provider")}
              </label>
              <TextInput
                id="login-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder={t("anthropic, openai, google, openrouter…")}
                spellCheck={false}
                autoFocus
                className="mt-1.5"
              />
              <div className="mt-3 flex gap-1.5">
                <Method active={!apiKey} onClick={() => setApiKey(false)}>
                  <LogIn size={12} />
                  {t("Account sign-in")}
                </Method>
                <Method active={apiKey} onClick={() => setApiKey(true)}>
                  <KeyRound size={12} />
                  {t("API key")}
                </Method>
              </div>
              <p className="mt-3 text-micro leading-4 text-faint">
                {t(
                  "Account sign-in opens the provider's browser flow. API key mode asks for the key in the terminal. Use pi's provider docs if you are unsure of the provider id.",
                )}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <a
                  href="https://pi.dev/docs/latest/providers"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    void api.openExternal("https://pi.dev/docs/latest/providers");
                  }}
                  className="mr-auto self-center text-micro text-subtle underline underline-offset-2 hover:text-fg"
                >
                  {t("Provider docs")}
                </a>
                <button
                  type="button"
                  disabled={starting || !provider.trim()}
                  onClick={() => void start()}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-label font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  {starting ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
                  {t("Start sign-in")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div
                ref={host}
                className="h-[380px] min-h-[240px] overflow-hidden bg-[var(--term-bg)] p-2"
              />
              <div className="flex items-center gap-2 border-t border-border px-4 py-2">
                <span className="text-micro text-faint">
                  {exited
                    ? exited.code === 0
                      ? t("Finished. You can close this window.")
                      : t("The login did not complete.")
                    : t("Credential surface · output is not logged")}
                </span>
                <button
                  type="button"
                  onClick={() => void cancel()}
                  className="ml-auto h-7 rounded-md border border-control px-2.5 text-label text-subtle hover:bg-surface-2 hover:text-fg"
                >
                  {exited ? t("Close") : t("Cancel")}
                </button>
              </div>
            </div>
          )}
        </DialogSurface>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Method({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-label transition-colors",
        active
          ? "border-brand/40 bg-brand-soft text-brand-ink"
          : "border-border text-subtle hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
