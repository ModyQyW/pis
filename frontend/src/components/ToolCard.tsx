import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileText,
  FolderSearch,
  Pencil,
  Search,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { cn } from "../lib/cn";
import type { AssistantBlock, ToolBlock, ToolResultView } from "../lib/transcript";
import { toolTarget } from "../lib/transcript";
import { DiffView } from "./DiffView";

export function ToolCard({ tool }: { tool: ToolBlock }) {
  const [open, setOpen] = useState(false);
  const result = tool.result;
  const run = tool.run;
  const running = !result && (!run || run.running);
  const failed = result?.isError || run?.isError;
  const output = result?.text || run?.text || "";
  const details = result?.details as { diff?: string; patch?: string } | undefined;
  const diff = details?.diff || details?.patch || "";
  const target = toolTarget(tool.name, tool.args);
  const Icon = iconFor(tool.name);
  const hasBody = Boolean(output || diff || result?.images.length || Object.keys(tool.args).length);

  return (
    <div className="my-1.5 overflow-hidden rounded-lg border border-border/80 bg-surface/70">
      <button
        type="button"
        onClick={() => hasBody && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors",
          hasBody && "hover:bg-surface-2/60",
        )}
      >
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-canvas text-subtle">
          <Icon size={11} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[11.5px] font-medium">{labelFor(tool.name)}</span>
            {target ? (
              <span className="truncate font-mono text-[10.5px] text-subtle">{target}</span>
            ) : null}
          </span>
          {!open && output && !diff ? (
            <span className="mt-0.5 line-clamp-1 block font-mono text-[10.5px] text-faint">
              {output.split("\n")[0]}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex shrink-0 items-center gap-1.5 text-[10px] text-faint">
          {running ? (
            <span className="size-2.5 animate-spin rounded-full border border-border-strong border-t-accent" />
          ) : failed ? (
            <CircleAlert size={12} className="text-danger" />
          ) : (
            <Check size={12} className="text-success" />
          )}
          {result?.durationMs != null ? <span>{result.durationMs}ms</span> : null}
          {hasBody ? (
            open ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : null}
        </span>
      </button>

      {open ? (
        <div className="border-t border-border/70 px-2.5 py-2">
          {diff ? <DiffView diff={diff} /> : null}
          {!diff && output ? (
            <pre className="max-h-[420px] overflow-auto scroll-thin whitespace-pre-wrap break-words rounded-md border border-border bg-canvas px-2.5 py-2 font-mono text-[10.5px] leading-[1.55] text-subtle">
              {output}
            </pre>
          ) : null}
          {result?.images.length ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {result.images.map((img, i) => (
                <img
                  key={i}
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt="Tool result"
                  className="max-h-[260px] w-full rounded-md border border-border object-contain"
                />
              ))}
            </div>
          ) : null}
          {!output && !diff && !result?.images.length && Object.keys(tool.args).length ? (
            <pre className="max-h-[260px] overflow-auto scroll-thin whitespace-pre-wrap rounded-md border border-border bg-canvas px-2.5 py-2 font-mono text-[10.5px] leading-[1.55] text-subtle">
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function StandaloneTool({ tool }: { tool: ToolBlock }) {
  return <ToolCard tool={tool} />;
}

function iconFor(name: string) {
  switch (name) {
    case "bash":
      return SquareTerminal;
    case "read":
      return FileText;
    case "edit":
    case "write":
      return Pencil;
    case "grep":
      return Search;
    case "find":
    case "ls":
      return FolderSearch;
    default:
      return Wrench;
  }
}

function labelFor(name: string) {
  switch (name) {
    case "bash":
      return "Shell";
    case "read":
      return "Read";
    case "edit":
      return "Edit";
    case "write":
      return "Write";
    case "grep":
      return "Search";
    case "find":
      return "Find";
    case "ls":
      return "List";
    case "todo":
      return "Todo";
    case "ask_user_question":
      return "Question";
    case "subagent":
      return "Subagent";
    default:
      return name;
  }
}

export type { AssistantBlock, ToolResultView };
