import { ArrowUpRight, Bug, FileSearch, GitPullRequest } from "lucide-react";

import { t } from "../lib/i18n";
import type { Workspace } from "../lib/types";
import { BrandMark } from "./BrandMark";

const starters = [
  {
    icon: FileSearch,
    label: "Explain this codebase",
    prompt:
      "Give me a tour of this codebase: the main entry points, the data flow, and where I should start reading.",
  },
  {
    icon: Bug,
    label: "Find and fix a bug",
    prompt: "Look for a real bug in this project, explain the root cause, and fix it with a test.",
  },
  {
    icon: GitPullRequest,
    label: "Review my changes",
    prompt: "Review the current uncommitted changes for correctness, risks, and missing tests.",
  },
];

export function EmptyState({
  workspace,
  onStarter,
}: {
  workspace: Workspace | null;
  onStarter: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-col justify-center px-8 pb-10 pt-16">
      <div className="mb-5 flex items-center gap-3">
        <BrandMark size={38} />
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
          {workspace ? workspace.name : "PiS"}
        </div>
      </div>
      <h1 className="max-w-[560px] text-balance text-[30px] font-semibold leading-[1.15] tracking-[-0.025em]">
        {t("What are we building?")}
      </h1>
      <p className="mt-3 max-w-[520px] text-[13.5px] leading-6 text-subtle">
        {t(
          "Pi works in your project folder with your models, skills, and extensions. Describe the outcome; it will inspect, edit, and run commands.",
        )}
      </p>

      <div className="mt-8 grid max-w-[620px] gap-2 sm:grid-cols-3">
        {starters.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => onStarter(t(prompt))}
            className="group flex flex-col items-start gap-3 rounded-xl border border-border/80 bg-surface/70 p-3.5 text-left transition-colors hover:border-border-strong hover:bg-surface"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-subtle transition-colors group-hover:text-brand">
              <Icon size={14} />
            </span>
            <span className="flex w-full items-start justify-between gap-2">
              <span className="text-[12px] font-medium leading-4">{t(label)}</span>
              <ArrowUpRight size={12} className="mt-0.5 shrink-0 text-faint" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
