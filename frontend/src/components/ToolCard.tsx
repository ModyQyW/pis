import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileText,
  FolderSearch,
  HelpCircle,
  Pencil,
  Search,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { cn } from "../lib/cn";
import { t } from "../lib/i18n";
import { parseAnswers, parseQuestions, type Question } from "../lib/questions";
import type { AssistantBlock, ToolBlock, ToolResultView } from "../lib/transcript";
import { toolTarget } from "../lib/transcript";
import { DiffView } from "./DiffView";

export function ToolCard({ tool }: { tool: ToolBlock }) {
  const [open, setOpen] = useState(false);
  const questions = tool.name === "ask_user_question" ? parseQuestions(tool.args) : [];
  if (questions.length > 0) return <QuestionCard tool={tool} questions={questions} />;
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
            <span className="text-[11.5px] font-medium">{t(labelFor(tool.name))}</span>
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
          {hasBody ? open ? <ChevronDown size={12} /> : <ChevronRight size={12} /> : null}
        </span>
      </button>

      {open ? (
        <div className="border-t border-border/70 px-2.5 py-2">
          {diff ? <DiffView diff={diff} /> : null}
          {!diff && output ? (
            <pre className="max-h-[420px] overflow-auto scroll-thin whitespace-pre-wrap break-words rounded-md border border-border bg-canvas px-2.5 py-2 font-mono code-text-dense leading-[1.55] text-subtle">
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
            <pre className="max-h-[260px] overflow-auto scroll-thin whitespace-pre-wrap rounded-md border border-border bg-canvas px-2.5 py-2 font-mono code-text-dense leading-[1.55] text-subtle">
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

function QuestionCard({ tool, questions }: { tool: ToolBlock; questions: Question[] }) {
  const answers = parseAnswers(tool.result?.details);
  return (
    <div className="my-1.5 overflow-hidden rounded-lg border border-brand/25 bg-surface/70">
      <div className="flex items-center gap-2 border-b border-border/70 bg-brand-soft/30 px-2.5 py-2">
        <span className="flex size-5 items-center justify-center rounded-md border border-brand/25 bg-surface text-brand">
          <HelpCircle size={11} />
        </span>
        <span className="text-[11.5px] font-medium">{t("Question")}</span>
        <span className="ml-auto text-[9.5px] text-faint">
          {tool.result ? t("Answered") : t("Waiting for answer")}
        </span>
      </div>
      <div className="space-y-2.5 px-2.5 py-2">
        {questions.map((question, index) => {
          const answer = answers.find((item) => item.questionIndex === index)?.answer;
          return (
            <div key={`${question.question}-${index}`}>
              {question.header ? (
                <div className="text-[9px] font-medium uppercase tracking-[0.08em] text-faint">
                  {question.header}
                </div>
              ) : null}
              <div className="mt-0.5 text-[11.5px] leading-5 text-subtle">{question.question}</div>
              {question.options.length ? (
                <ul className="mt-1.5 space-y-1">
                  {question.options.map((option) => {
                    const selected = answer === option.label;
                    return (
                      <li
                        key={option.label}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-2 py-1.5 text-[10.5px] leading-4",
                          selected
                            ? "border-brand/40 bg-brand-soft/50 text-fg"
                            : "border-border/70 text-subtle",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-3 shrink-0 items-center justify-center rounded-full border",
                            selected
                              ? "border-brand bg-brand text-brand-fg"
                              : "border-border-strong",
                          )}
                        >
                          {selected ? <Check size={8} /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block">{option.label}</span>
                          {option.description ? (
                            <span className="mt-0.5 block text-[9.5px] text-faint">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
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
