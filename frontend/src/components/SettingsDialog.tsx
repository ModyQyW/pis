import * as Dialog from "@/components/ui/dialog-compat";
import { Check, Clipboard, FolderOpen, RefreshCw, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "../lib/toast";

import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { platformName } from "../lib/format";
import { t as tr } from "../lib/i18n";
import type { Bootstrap, Diagnostics, Theme } from "../lib/types";

const CODE_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const UI_SIZES = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export function SettingsDialog({
  open,
  onOpenChange,
  boot,
  theme,
  onTheme,
  onReload,
  onLogin,
  onMCP,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boot: Bootstrap;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onReload: () => void;
  onLogin?: () => void;
  onMCP?: () => void;
}) {
  const [path, setPath] = useState(boot.settings.piPath ?? boot.pi.path ?? "");
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPath(boot.settings.piPath ?? boot.pi.path ?? "");
  }, [boot.settings.piPath]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    api
      .diagnostics()
      .then((d) => {
        if (alive) setDiag(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  const savePath = async () => {
    setBusy(true);
    try {
      const status = await api.setPiPath(path);
      onReload();
      toast(
        status.compatible
          ? tr("Using pi {version}", { version: status.version ?? "" })
          : status.error || tr("pi was not found"),
        {
          description: status.path,
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    try {
      const status = await api.checkPi();
      onReload();
      toast(
        status.compatible
          ? tr("pi {version} is ready", { version: status.version ?? "" })
          : status.error || tr("pi was not found"),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const savePref = async (p: Parameters<typeof api.setPreferences>[0]) => {
    setBusy(true);
    try {
      await api.setPreferences(p);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copyReport = async () => {
    if (!diag) return;
    const report = [
      `PiS ${diag.appVersion}`,
      `${platformName(diag.platform)} ${diag.arch}`,
      `data: ${diag.dataDir}`,
      `settings: ${diag.settings}`,
      `pi: ${diag.pi.path ?? "not found"} ${diag.pi.version ?? ""}`,
      diag.settingsError ? `settings error: ${diag.settingsError}` : "",
      ...diag.notes,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(report);
      toast.success(tr("Support report copied"));
    } catch {
      toast.error(tr("Could not access the clipboard"));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(720px,calc(100vh-64px))] w-[min(720px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border-strong bg-surface shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <Dialog.Title className="text-[14px] font-semibold">{tr("Settings")}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[11px] text-faint">
                PiS {boot.appVersion} · {platformName(boot.platform)}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
                aria-label={tr("Close settings")}
              >
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-5 py-4">
            <Section title={tr("Appearance")}>
              <div className="flex gap-1.5">
                {(["system", "light", "dark"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onTheme(option)}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11.5px] capitalize transition-colors",
                      theme === option
                        ? "border-brand/40 bg-brand-soft text-brand"
                        : "border-border text-subtle hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {theme === option ? <Check size={12} /> : null}
                    {tr(option.charAt(0).toUpperCase() + option.slice(1))}
                  </button>
                ))}
              </div>
              <label className="mt-2.5 flex items-center gap-2 text-[11px] text-subtle">
                <span>{tr("Language")}</span>
                <select
                  value={boot.settings.language === "zh" ? "zh" : "en"}
                  onChange={async (e) => {
                    setBusy(true);
                    try {
                      await api.setPreferences({ language: e.target.value });
                      onReload();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="h-7 rounded-md border border-border bg-canvas px-2 text-[11px] outline-none focus:border-border-strong"
                >
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                </select>
              </label>
              <label className="mt-2.5 flex items-start gap-2 text-[11px] leading-4 text-subtle">
                <input
                  type="checkbox"
                  checked={boot.settings.showWidgets}
                  onChange={async (e) => {
                    setBusy(true);
                    try {
                      await api.setPreferences({ showWidgets: e.target.checked });
                      onReload();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="mt-0.5 size-3.5 accent-[var(--brand)]"
                />
                <span>
                  {tr("Show raw extension widgets")}
                  <span className="block text-[10px] text-faint">
                    {tr(
                      "TUI widgets are off by default because they are designed for a terminal, not this layout.",
                    )}
                  </span>
                </span>
              </label>
              <label className="mt-2.5 flex items-start gap-2 text-[11px] leading-4 text-subtle">
                <input
                  type="checkbox"
                  checked={boot.settings.notifications}
                  onChange={async (e) => {
                    setBusy(true);
                    try {
                      await api.setPreferences({ notifications: e.target.checked });
                      onReload();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="mt-0.5 size-3.5 accent-[var(--brand)]"
                />
                <span>
                  {tr("Desktop notifications")}
                  <span className="block text-[10px] text-faint">
                    {tr(
                      "Notify when a background run finishes. The setting is off if the system does not allow notifications.",
                    )}
                  </span>
                </span>
              </label>
              <button
                type="button"
                disabled={busy || !boot.settings.notifications}
                onClick={async () => {
                  try {
                    await api.notify("test", "PiS", "Notifications are working.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : String(err));
                  }
                }}
                className="mt-2 h-7 rounded-md border border-border px-2.5 text-[10.5px] text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-40"
              >
                {tr("Test notification")}
              </button>
            </Section>

            <Section
              title={tr("Text and input")}
              description={tr(
                "Code size covers Markdown code blocks, diffs, tool output, and previews. Interface size scales the whole window.",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-subtle">
                <label className="flex items-center gap-2">
                  <span>{tr("Code font size")}</span>
                  <select
                    value={boot.settings.codeFontSize}
                    disabled={busy}
                    onChange={(e) => void savePref({ codeFontSize: Number(e.target.value) })}
                    className="h-7 rounded-md border border-border bg-canvas px-2 text-[11px] outline-none focus:border-border-strong"
                  >
                    {CODE_FONT_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}px
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span>{tr("Interface size")}</span>
                  <select
                    value={boot.settings.uiFontSize}
                    disabled={busy}
                    onChange={(e) => void savePref({ uiFontSize: Number(e.target.value) })}
                    className="h-7 rounded-md border border-border bg-canvas px-2 text-[11px] outline-none focus:border-border-strong"
                  >
                    {UI_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {Math.round((size / 14) * 100)}%
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-start gap-2 leading-4">
                  <input
                    type="checkbox"
                    checked={boot.settings.sendOnEnter}
                    disabled={busy}
                    onChange={(e) => void savePref({ sendOnEnter: e.target.checked })}
                    className="mt-0.5 size-3.5 accent-[var(--brand)]"
                  />
                  <span>
                    {tr("Send on Enter")}
                    <span className="block text-[10px] text-faint">
                      {tr("Off: ⌘Enter sends and Enter adds a line.")}
                    </span>
                  </span>
                </label>
              </div>
            </Section>

            <Section
              title={tr("Providers")}
              description={tr(
                "PiS uses pi's own credentials. Sign-in runs pi's terminal login and stores nothing itself.",
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onLogin}
                  className="h-8 rounded-md border border-border px-3 text-[11.5px] text-subtle hover:bg-surface-2 hover:text-fg"
                >
                  {tr("Sign in to a provider…")}
                </button>
                <button
                  type="button"
                  onClick={onMCP}
                  disabled={!onMCP}
                  className="h-8 rounded-md border border-border px-3 text-[11.5px] text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                >
                  {tr("MCP servers…")}
                </button>
                <span className="text-[10.5px] text-faint">
                  {boot.pi.compatible
                    ? tr("Credentials live in pi's auth store")
                    : tr("Locate pi first")}
                </span>
              </div>
            </Section>

            <Section
              title={tr("pi executable")}
              description={tr("PiS uses the pi you already have. It never installs or updates it.")}
            >
              <div className="flex gap-2">
                <input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder={tr("Auto-detect pi")}
                  className="h-8 min-w-0 flex-1 rounded-md border border-border bg-canvas px-2.5 text-[11.5px] outline-none placeholder:text-faint focus:border-border-strong"
                  spellCheck={false}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={savePath}
                  className="h-8 rounded-md border border-border px-3 text-[11.5px] text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-50"
                >
                  {tr("Use path")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={check}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[11.5px] text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-50"
                >
                  <RefreshCw size={12} />
                  {tr("Check")}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-faint">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    boot.pi.compatible ? "bg-success" : boot.pi.found ? "bg-danger" : "bg-faint",
                  )}
                />
                {boot.pi.checking
                  ? tr("Looking for pi…")
                  : boot.pi.found
                    ? `pi ${boot.pi.version} · ${boot.pi.path}`
                    : tr("pi was not found")}
              </div>
              {boot.pi.error ? (
                <p className="mt-1.5 text-[11px] leading-4 text-danger">{boot.pi.error}</p>
              ) : null}
            </Section>

            <Section
              title={tr("Approvals")}
              description={tr(
                "PiS can ask before destructive or out-of-workspace actions. It never replaces an existing guard unless you enable it here.",
              )}
            >
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["smart", "Smart"],
                    ["ask", "Ask all"],
                    ["allow", "Allow all"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api.setPreferences({
                          policy: value,
                          guardDisabled: false,
                          guardForce: value !== "allow" && boot.guard.detected.length > 0,
                        });
                        onReload();
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={cn(
                      "h-8 rounded-md border px-3 text-[11.5px] transition-colors",
                      boot.settings.permissions.policy === value
                        ? "border-brand/40 bg-brand-soft text-brand"
                        : "border-border text-subtle hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {tr(label)}
                  </button>
                ))}
              </div>
              <label className="mt-2.5 flex items-start gap-2 text-[11px] leading-4 text-subtle">
                <input
                  type="checkbox"
                  checked={boot.guard.active}
                  onChange={async (e) => {
                    setBusy(true);
                    try {
                      await api.setPreferences({
                        guardDisabled: !e.target.checked,
                        guardForce: e.target.checked,
                        policy:
                          e.target.checked && boot.settings.permissions.policy === "allow"
                            ? "smart"
                            : undefined,
                      });
                      onReload();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="mt-0.5 size-3.5 accent-[var(--brand)]"
                />
                <span>
                  {tr("Use PiS approvals")}
                  <span className="block text-[10px] text-faint">
                    {boot.guard.detected.length
                      ? tr(
                          "Another guard is present ({names}); built-in approvals stay off unless enabled.",
                          { names: boot.guard.detected.join(", ") },
                        )
                      : tr(
                          "Destructive shell commands, sensitive files, and edits outside the project ask first.",
                        )}
                  </span>
                </span>
              </label>
              {boot.guard.detected.length > 0 ? (
                <p className="mt-1.5 rounded-md border border-warning/25 bg-warning/5 px-2 py-1.5 text-[10px] leading-4 text-warning">
                  {tr("Detected: {names}. Both guards are never enabled by default.", {
                    names: boot.guard.detected.join(", "),
                  })}
                </p>
              ) : null}
            </Section>

            <Section
              title={tr("Updates")}
              description={tr(
                "Updates come from GitHub Releases. PiS checks once a day in the background.",
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api.checkUpdates();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[11.5px] text-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-50"
                >
                  <RefreshCw size={12} />
                  {tr("Check for updates…")}
                </button>
                <span className="text-[10.5px] text-faint">PiS {boot.appVersion}</span>
              </div>
            </Section>

            <Section
              title={tr("Diagnostics")}
              description={tr(
                "Paths and versions only. Prompts and credentials are never included.",
              )}
            >
              <div className="rounded-lg border border-border bg-canvas p-3 font-mono text-[10.5px] leading-5 text-subtle">
                <div className="truncate">data {diag?.dataDir ?? boot.dataDir}</div>
                <div className="truncate">settings {diag?.settings ?? "settings.json"}</div>
                {diag?.settingsError ? (
                  <div className="text-danger">{diag.settingsError}</div>
                ) : null}
                {diag?.notes.map((note) => (
                  <div key={note} className="text-faint">
                    {note}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={copyReport}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[11.5px] text-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <Clipboard size={12} />
                  {tr("Copy report")}
                </button>
                <button
                  type="button"
                  onClick={() => api.reveal(boot.dataDir)}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[11.5px] text-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <FolderOpen size={12} />
                  {tr("Reveal data folder")}
                </button>
              </div>
            </Section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 last:mb-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-[560px] text-[11px] leading-4 text-faint">{description}</p>
      ) : null}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}
