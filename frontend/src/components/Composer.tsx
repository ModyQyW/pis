import {
  ArrowUp,
  CornerDownLeft,
  FileText,
  Paperclip,
  Plus,
  Square,
  Target,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n";
import { toast } from "../lib/toast";

import {
  Attachment as AttachmentChip,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import type { ContextBreakdown } from "../mygo";
import type { Attachment, CommandInfo } from "../lib/pi-types";

export function Composer({
  draft,
  onDraft,
  onSubmit,
  running,
  onStop,
  disabled,
  modelLabel,
  thinking,
  contextUsage,
  contextBreakdown,
  compacting,
  onCompact,
  onContextOpen,
  onOpenModelPicker,
  workspace,
  commands,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  planMode,
  externalPlanCommand,
  onTogglePlan,
  sendOnEnter = true,
}: {
  draft: string;
  onDraft: (text: string) => void;
  onSubmit: () => void;
  running: boolean;
  onStop: () => void;
  disabled: boolean;
  modelLabel: string;
  thinking?: string;
  contextUsage?: {
    tokens: number | null;
    contextWindow: number;
    percent: number | null;
  } | null;
  contextBreakdown?: ContextBreakdown | null;
  compacting?: boolean;
  onCompact?: () => void;
  onContextOpen?: () => void;
  onOpenModelPicker?: () => void;
  workspace?: string;
  commands?: CommandInfo[];
  attachments?: Attachment[];
  onAddAttachment?: (attachment: Attachment) => void;
  onRemoveAttachment?: (id: string) => void;
  planMode?: boolean;
  externalPlanCommand?: string;
  onTogglePlan?: () => void;
  sendOnEnter?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState(0);
  const [fileHits, setFileHits] = useState<{ path: string; name: string }[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const token = useToken(draft, cursor);
  const suggestions: Suggestion[] =
    token?.kind === "command"
      ? (commands ?? [])
          .filter((c) => {
            const q = token.query.toLowerCase();
            return (
              !q || c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
            );
          })
          .slice(0, 9)
          .map((c) => ({
            id: `cmd:${c.name}`,
            label: `/${c.name}`,
            description: c.description,
            badge: c.source,
            insert: `/${c.name} `,
          }))
      : token?.kind === "file"
        ? fileHits.slice(0, 9).map((f) => ({
            id: `file:${f.path}`,
            label: f.path,
            description: undefined,
            badge: "file",
            insert: `@${f.path} `,
          }))
        : [];

  useEffect(() => {
    if (token?.kind !== "file" || !workspace) {
      setFileHits([]);
      return;
    }
    let alive = true;
    setFileLoading(true);
    const id = window.setTimeout(() => {
      api
        .searchFiles(workspace, token.query, 9)
        .then((hits) => {
          if (alive) setFileHits(hits);
        })
        .catch(() => {
          if (alive) setFileHits([]);
        })
        .finally(() => {
          if (alive) setFileLoading(false);
        });
    }, 100);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [token?.kind, token?.query, workspace]);

  useEffect(() => {
    setSelected(0);
  }, [token?.kind, token?.query, suggestions.length]);

  const chooseSuggestion = (s: Suggestion) => {
    if (!token) return;
    const next = draft.slice(0, token.start) + s.insert + draft.slice(cursor);
    onDraft(next);
    const pos = token.start + s.insert.length;
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
        setCursor(pos);
      }
    });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [draft]);

  const canSend = (draft.trim().length > 0 || (attachments?.length ?? 0) > 0) && !disabled;
  const contextPercent = contextUsage?.percent ?? null;
  const contextTotal = contextUsage?.tokens ?? null;
  const contextWindow = contextUsage?.contextWindow ?? null;
  const systemTokens = contextBreakdown
    ? contextBreakdown.system +
      contextBreakdown.tools +
      contextBreakdown.skills +
      contextBreakdown.project
    : null;
  const messageTokens =
    contextTotal != null && systemTokens != null ? Math.max(0, contextTotal - systemTokens) : null;
  const freeTokens =
    contextTotal != null && contextWindow != null
      ? Math.max(0, contextWindow - contextTotal)
      : null;
  const totalLabel =
    contextTotal == null
      ? t("Waiting for usage data")
      : t("Context: {used} / {max} tokens ({percent}%)", {
          used: contextTotal.toLocaleString(),
          max: contextWindow?.toLocaleString() ?? "?",
          percent: Math.round(contextPercent ?? 0),
        });
  const breakdownRows = contextBreakdown
    ? [
        { label: t("System prompt"), value: contextBreakdown.system },
        { label: t("Tools"), value: contextBreakdown.tools },
        { label: t("Skills"), value: contextBreakdown.skills },
        { label: t("Project context"), value: contextBreakdown.project },
      ]
    : [];

  const readFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      if (file.type.startsWith("image/")) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 10 MB`);
          continue;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("image read did not return a data URL"));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const comma = dataUrl.indexOf(",");
        onAddAttachment?.({
          id,
          kind: "image",
          name: file.name || "pasted image",
          mimeType: file.type,
          data: dataUrl.slice(comma + 1),
          size: file.size,
        });
      } else {
        if (file.size > 512 * 1024) {
          toast.error(`${file.name} is larger than 512 KB`);
          continue;
        }
        const text = await file.text();
        if (text.includes("\u0000")) {
          toast.error(`${file.name} looks binary`);
          continue;
        }
        onAddAttachment?.({
          id,
          kind: "text",
          name: file.name,
          mimeType: file.type || "text/plain",
          text,
          size: file.size,
        });
      }
    }
  };

  return (
    <div className="shrink-0 px-5 pb-5 pt-2">
      <div className="@container mx-auto w-full max-w-chat">
        <div
          className={cn(
            "rounded-2xl border bg-surface shadow-float transition-colors",
            focused ? "border-border-strong" : "border-border",
          )}
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void readFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {attachments && attachments.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
              {attachments.map((a) => (
                <AttachmentChip key={a.id} size="xs">
                  <AttachmentMedia variant={a.kind === "image" && a.data ? "image" : "icon"}>
                    {a.kind === "image" && a.data ? (
                      <img src={`data:${a.mimeType};base64,${a.data}`} alt={a.name} />
                    ) : (
                      <FileText />
                    )}
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle className="max-w-[150px]">{a.name}</AttachmentTitle>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      onClick={() => onRemoveAttachment?.(a.id)}
                      aria-label={`Remove ${a.name}`}
                    >
                      <X />
                    </AttachmentAction>
                  </AttachmentActions>
                </AttachmentChip>
              ))}
            </div>
          ) : null}
          <textarea
            ref={ref}
            value={draft}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.items)
                .filter((item) => item.kind === "file")
                .map((item) => item.getAsFile())
                .filter((f): f is File => Boolean(f));
              if (files.length) {
                e.preventDefault();
                void readFiles(files);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              if (e.dataTransfer.files.length) {
                e.preventDefault();
                void readFiles(e.dataTransfer.files);
              }
            }}
            onChange={(e) => {
              onDraft(e.target.value);
              setCursor(e.target.selectionStart);
            }}
            onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={(e) => {
              if (suggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelected((v) => (v + 1) % suggestions.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected((v) => (v - 1 + suggestions.length) % suggestions.length);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelected(0);
                  setCursor(-1);
                  return;
                }
                if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
                  e.preventDefault();
                  const s = suggestions[selected];
                  if (s) chooseSuggestion(s);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                if (!sendOnEnter && !(e.metaKey || e.ctrlKey)) return;
                e.preventDefault();
                if (canSend) onSubmit();
              }
            }}
            rows={1}
            placeholder={t("Ask pi to inspect, change, or explain…")}
            disabled={disabled}
            className="max-h-[260px] min-h-[64px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-body leading-6 outline-none placeholder:text-faint disabled:opacity-60"
          />

          {suggestions.length > 0 && !disabled ? (
            <div className="mx-2 mb-1 max-h-[240px] overflow-y-auto scroll-thin rounded-lg border border-border bg-surface p-1 shadow-popover">
              <div className="flex items-center justify-between px-1.5 pb-1 pt-0.5 text-micro uppercase tracking-label text-faint">
                <span>{token?.kind === "command" ? t("Pi commands") : t("Files")}</span>
                {fileLoading ? <span>{t("searching…")}</span> : null}
              </div>
              {suggestions.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chooseSuggestion(s)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors",
                    i === selected
                      ? "bg-surface-2 text-fg"
                      : "text-subtle hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <FileText size={11} className="mt-1 shrink-0 text-faint" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-label">{s.label}</span>
                    {s.description ? (
                      <span className="mt-0.5 line-clamp-1 block text-micro text-faint">
                        {s.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 shrink-0 text-micro text-faint">{s.badge}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1 gap-y-1.5 px-2.5 pb-2.5">
            <Tooltip>
              <TooltipTrigger
                onClick={() => {
                  const el = ref.current;
                  const at = el ? el.selectionStart : draft.length;
                  const next = `${draft.slice(0, at)}@${draft.slice(at)}`;
                  onDraft(next);
                  requestAnimationFrame(() => {
                    el?.focus();
                    el?.setSelectionRange(at + 1, at + 1);
                    setCursor(at + 1);
                  });
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
                aria-label={t("Mention a project file")}
              >
                <Plus size={15} />
              </TooltipTrigger>
              <TooltipContent>{t("Mention a project file")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                onClick={() => fileInput.current?.click()}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
                aria-label={t("Attach a file")}
              >
                <Paperclip size={14} />
              </TooltipTrigger>
              <TooltipContent>{t("Attach a file")}</TooltipContent>
            </Tooltip>

            <div className="ml-1 flex min-w-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  onClick={onOpenModelPicker}
                  className="flex h-7 max-w-[240px] items-center gap-1.5 rounded-lg px-2 text-label text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <span className="size-1.5 rounded-full bg-brand/70" />
                  <span className="truncate">{modelLabel}</span>
                </TooltipTrigger>
                <TooltipContent>{t("Model and thinking")}</TooltipContent>
              </Tooltip>
              {thinking ? (
                <Tooltip>
                  <TooltipTrigger
                    onClick={onOpenModelPicker}
                    className="hidden h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-micro capitalize text-faint transition-colors hover:bg-surface-2 hover:text-fg sm:flex"
                  >
                    {thinking}
                  </TooltipTrigger>
                  <TooltipContent>{t("Thinking level")}</TooltipContent>
                </Tooltip>
              ) : null}
              <Tooltip>
                <TooltipTrigger
                  onClick={() => {
                    if (externalPlanCommand) {
                      const next = draft.trim()
                        ? `${draft.replace(/\s+$/, "")} /${externalPlanCommand} `
                        : `/${externalPlanCommand} `;
                      onDraft(next);
                      requestAnimationFrame(() => {
                        const el = ref.current;
                        if (el) {
                          el.focus();
                          el.setSelectionRange(next.length, next.length);
                          setCursor(next.length);
                        }
                      });
                    } else {
                      onTogglePlan?.();
                    }
                  }}
                  className={cn(
                    "hidden h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-label transition-colors hover:bg-surface-2 sm:flex",
                    planMode ? "bg-brand-soft text-brand-ink" : "text-subtle hover:text-fg",
                  )}
                >
                  <Target size={12} />
                  {planMode ? t("Planning") : t("Plan")}
                </TooltipTrigger>
                <TooltipContent>
                  {externalPlanCommand
                    ? t("Use the installed /{command} command", { command: externalPlanCommand })
                    : t("Plan mode: read-only until you approve")}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="hidden text-micro text-faint @[26rem]:inline">
                {running
                  ? t("Enter queues · Esc stops")
                  : sendOnEnter
                    ? t("Enter sends · Shift+Enter newline")
                    : t("⌘Enter sends · Enter newline")}
              </span>
              <Popover onOpenChange={(open) => open && onContextOpen?.()}>
                <PopoverTrigger
                  aria-label={totalLabel}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-nano font-medium tabular-nums text-faint transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  {contextPercent == null ? "0%" : `${Math.round(contextPercent)}%`}
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-label font-medium text-fg">{t("Context")}</span>
                    <span className="text-micro tabular-nums text-faint">
                      {contextPercent == null ? "0%" : `${Math.round(contextPercent)}%`}
                    </span>
                  </div>
                  <div className="mt-0.5 text-micro tabular-nums text-faint">{totalLabel}</div>
                  {contextBreakdown ? (
                    <div className="mt-3 space-y-1 text-micro tabular-nums">
                      {breakdownRows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                          <span className="text-faint">{row.label}</span>
                          <span className="text-subtle">~{countLabel(row.value)}</span>
                        </div>
                      ))}
                      {messageTokens != null ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-faint">{t("Messages")}</span>
                          <span className="text-subtle">~{countLabel(messageTokens)}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-micro leading-4 text-faint">
                      {t("Context breakdown is not available yet.")}
                    </p>
                  )}
                  {freeTokens != null ? (
                    <div className="mt-1.5 flex items-center justify-between border-t border-border/70 pt-1.5 text-micro tabular-nums">
                      <span className="text-faint">{t("Free space")}</span>
                      <span className="text-subtle">{countLabel(freeTokens)}</span>
                    </div>
                  ) : null}
                  {contextBreakdown ? (
                    <p className="mt-2 text-micro leading-4 text-faint">
                      {t("Category values are estimates.")}
                    </p>
                  ) : null}
                  <PopoverClose
                    onClick={onCompact}
                    disabled={!onCompact || compacting}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "mt-3 w-full",
                    })}
                  >
                    {compacting ? t("Compacting…") : t("Compact context")}
                  </PopoverClose>
                </PopoverContent>
              </Popover>
              {running ? (
                <Tooltip>
                  <TooltipTrigger
                    onClick={onStop}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-[1.03]"
                    aria-label={t("Stop run")}
                  >
                    <Square size={11} fill="currentColor" />
                  </TooltipTrigger>
                  <TooltipContent>{t("Stop")}</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        disabled={!canSend}
                        onClick={onSubmit}
                        aria-label={t("Send")}
                      />
                    }
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full transition-all",
                      canSend ? "bg-fg text-canvas hover:scale-[1.03]" : "bg-surface-3 text-faint",
                    )}
                  >
                    <ArrowUp size={15} strokeWidth={2.2} />
                  </TooltipTrigger>
                  <TooltipContent>{t("Send")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-micro text-faint">
          <CornerDownLeft size={10} />
          <span>
            {disabled
              ? t("Connect a provider to start")
              : t("Pi can read, edit, and run commands in this project.")}
          </span>
        </div>
      </div>
    </div>
  );
}

function countLabel(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

type Suggestion = {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  insert: string;
};

type Token = { kind: "file" | "command"; start: number; query: string };

function useToken(text: string, cursor: number): Token | null {
  if (cursor < 0 || cursor > text.length) return null;
  const before = text.slice(0, cursor);
  if (/^\/[^\s]*$/.test(before)) {
    return { kind: "command", start: 0, query: before.slice(1) };
  }
  const at = before.lastIndexOf("@");
  if (at >= 0 && (at === 0 || /\s/.test(before[at - 1] ?? ""))) {
    const query = before.slice(at + 1);
    if (!/\s/.test(query)) return { kind: "file", start: at, query };
  }
  return null;
}
