import * as Dialog from "@/components/ui/dialog-compat";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { KeyRound, Loader2, LogIn, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "../lib/toast";

import "@xterm/xterm/css/xterm.css";

import { api } from "../lib/api";
import { cn } from "../lib/cn";

export function LoginDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
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
        toast.success("Provider connected");
        onDone();
      } else {
        toast.error(o.error || "Login did not complete");
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
    const t = new Terminal({
      fontFamily: styles.getPropertyValue("--font-mono").trim() || "monospace",
      fontSize: 12,
      lineHeight: 1.35,
      cursorBlink: true,
      theme: {
        background: "#141413",
        foreground: "#edeae3",
        cursor: "#e88a4b",
        selectionBackground: "#3a2a1d",
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
    const resize = t.onResize(({ cols, rows }) => void api.authResize(authId, cols, rows).catch(() => {}));
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
  }, [open, authId]);

  const start = async () => {
    if (!provider.trim()) return;
    setStarting(true);
    try {
      const info = await api.startAuth(provider.trim(), apiKey);
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(760px,calc(100vh-64px))] w-[min(680px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border-strong bg-surface shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <Dialog.Title className="text-[13.5px] font-semibold">
                Connect a provider
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[10.5px] text-faint">
                Runs pi's own login. Pi Mygo does not store or log credentials.
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={() => void cancel()}
              className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
              aria-label="Close login"
            >
              <X size={15} />
            </button>
          </div>

          {!authId ? (
            <div className="px-5 py-5">
              <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                Provider
              </label>
              <input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="anthropic, openai, google, openrouter…"
                spellCheck={false}
                autoFocus
                className="mt-1.5 h-8 w-full rounded-md border border-border bg-canvas px-2.5 text-[12px] outline-none placeholder:text-faint focus:border-border-strong"
              />
              <div className="mt-3 flex gap-1.5">
                <Method active={!apiKey} onClick={() => setApiKey(false)}>
                  <LogIn size={12} />
                  Account sign-in
                </Method>
                <Method active={apiKey} onClick={() => setApiKey(true)}>
                  <KeyRound size={12} />
                  API key
                </Method>
              </div>
              <p className="mt-3 text-[10.5px] leading-4 text-faint">
                Account sign-in opens the provider's browser flow. API key mode asks
                for the key in the terminal. Use pi's provider docs if you are unsure
                of the provider id.
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
                  className="mr-auto self-center text-[10.5px] text-subtle underline underline-offset-2 hover:text-fg"
                >
                  Provider docs
                </a>
                <button
                  type="button"
                  disabled={starting || !provider.trim()}
                  onClick={() => void start()}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-[11.5px] font-medium text-brand-fg hover:opacity-90 disabled:opacity-40"
                >
                  {starting ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
                  Start sign-in
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div
                ref={host}
                className="h-[380px] min-h-[240px] overflow-hidden bg-[#141413] p-2"
              />
              <div className="flex items-center gap-2 border-t border-border px-4 py-2">
                <span className="text-[10px] text-faint">
                  {exited
                    ? exited.code === 0
                      ? "Finished. You can close this window."
                      : "The login did not complete."
                    : "Credential surface · output is not logged"}
                </span>
                <button
                  type="button"
                  onClick={() => void cancel()}
                  className="ml-auto h-7 rounded-md border border-border px-2.5 text-[11px] text-subtle hover:bg-surface-2 hover:text-fg"
                >
                  {exited ? "Close" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
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
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] transition-colors",
        active
          ? "border-brand/40 bg-brand-soft text-brand"
          : "border-border text-subtle hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
