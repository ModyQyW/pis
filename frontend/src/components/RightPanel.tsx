import {
  Circle,
  CircleAlert,
  CircleCheck,
  FileText,
  GitBranch,
  ListTodo,
  Loader2,
  PanelRightClose,
  RefreshCw,
  Search,
  Undo2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { t } from "../lib/i18n";
import { extractSubagents, type SubagentRun } from "../lib/subagents";
import { extractTodos, type TodoItem } from "../lib/todos";
import { toast } from "../lib/toast";
import type { Hit, Status } from "../mygo";
import type { ChatSession } from "../store/chat";
import type { Workspace } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { DiffDialog } from "./DiffDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";

type Tab = "changes" | "files" | "plan" | "agents";

export function RightPanel({
  workspace,
  session,
  onClose,
}: {
  workspace: Workspace | null;
  session?: ChatSession | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("changes");
  const [status, setStatus] = useState<Status | null>(null);
  const [files, setFiles] = useState<Hit[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [diffPath, setDiffPath] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [revertPath, setRevertPath] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) {
      setStatus(null);
      setFiles([]);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    void Promise.all([
      api.gitStatus(workspace.path).catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
        return null;
      }),
      api.listFiles(workspace.path, 300).catch(() => []),
    ])
      .then(([st, list]) => {
        if (!alive) return;
        if (st) setStatus(st);
        setFiles(list);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [workspace, session?.key, session?.entries.length, session?.streaming, refresh]);

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, query]);
  const todos = useMemo(() => extractTodos(session?.entries ?? []), [session?.entries]);
  const subagents = useMemo(
    () => extractSubagents(session?.entries ?? [], session?.live?.blocks ?? []),
    [session?.entries, session?.live?.blocks],
  );

  const changed = status?.files.length ?? 0;
  const doneTodos = todos.filter((todo) => todo.done).length;

  return (
    <aside className="flex w-[var(--right-width)] shrink-0 flex-col border-l border-border bg-surface/50">
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b border-border/70 px-2">
        <TabButton active={tab === "changes"} onClick={() => setTab("changes")}>
          <GitBranch size={12} />
          {t("Changes")}
          {changed > 0 ? (
            <span className="ml-0.5 rounded-full bg-surface-3 px-1 text-micro tabular-nums text-subtle">
              {changed}
            </span>
          ) : null}
        </TabButton>
        <TabButton active={tab === "files"} onClick={() => setTab("files")}>
          <FileText size={12} />
          {t("Files")}
        </TabButton>
        <TabButton active={tab === "plan"} onClick={() => setTab("plan")}>
          <ListTodo size={12} />
          {t("Plan")}
          {todos.length > 0 ? (
            <span className="ml-0.5 rounded-full bg-surface-3 px-1 text-micro tabular-nums text-subtle">
              {doneTodos}/{todos.length}
            </span>
          ) : null}
        </TabButton>
        <TabButton active={tab === "agents"} onClick={() => setTab("agents")}>
          <Users size={12} />
          {t("Agents")}
          {subagents.length > 0 ? (
            <span className="ml-0.5 rounded-full bg-surface-3 px-1 text-micro tabular-nums text-subtle">
              {subagents.length}
            </span>
          ) : null}
        </TabButton>
        <button
          type="button"
          onClick={() => setRefresh((v) => v + 1)}
          className="ml-auto flex size-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label={t("Refresh panel")}
          title={t("Refresh")}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label={t("Close panel")}
          title={t("Close panel")}
        >
          <PanelRightClose size={14} />
        </button>
      </div>

      {workspace ? (
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-label text-subtle">
          <GitBranch size={11} className="text-faint" />
          <span className="truncate font-mono">{status?.branch || "—"}</span>
          {status?.ahead ? <span className="text-success">↑{status.ahead}</span> : null}
          {status?.behind ? <span className="text-warning">↓{status.behind}</span> : null}
          <span className="ml-auto truncate text-micro text-faint">
            {tab === "changes"
              ? t("{count} changed", { count: changed })
              : tab === "files"
                ? t("{count} files", { count: files.length })
                : tab === "plan"
                  ? t("{done}/{total} steps", { done: doneTodos, total: todos.length })
                  : t("{count} subagents", { count: subagents.length })}
          </span>
        </div>
      ) : null}

      {tab === "files" ? (
        <div className="flex items-center gap-2 border-b border-border/60 px-3">
          <Search size={12} className="text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Filter files…")}
            aria-label={t("Filter files…")}
            className="h-8 min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-faint"
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-1.5">
        {!workspace ? (
          <Empty
            icon={<GitBranch size={15} />}
            title={t("No project")}
            detail={t("Open a project to see changes.")}
          />
        ) : tab === "changes" ? (
          tabChanges(status, error, loading, setDiffPath, setRevertPath)
        ) : tab === "files" ? (
          <FileList files={filteredFiles} onOpen={setFilePath} />
        ) : tab === "plan" ? (
          <TodoList todos={todos} />
        ) : (
          <SubagentList runs={subagents} />
        )}
      </div>

      {workspace && diffPath ? (
        <DiffDialog
          open
          onOpenChange={(open) => !open && setDiffPath(null)}
          workspace={workspace.path}
          path={diffPath}
        />
      ) : null}
      {workspace && filePath ? (
        <FilePreviewDialog
          open
          onOpenChange={(open) => !open && setFilePath(null)}
          workspace={workspace.path}
          path={filePath}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(revertPath)}
        onOpenChange={(next) => !next && setRevertPath(null)}
        title={t("Revert {path}?", { path: revertPath ?? "file" })}
        message={t(
          "This restores the file from HEAD and discards both staged and unstaged changes. This cannot be undone by PiS.",
        )}
        confirmLabel={t("Revert file")}
        danger
        onConfirm={async () => {
          if (!workspace || !revertPath) return;
          try {
            await api.revertFile(workspace.path, revertPath);
            setRevertPath(null);
            setRefresh((v) => v + 1);
            toast.success(t("File reverted"));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        }}
      />
    </aside>
  );
}

function tabChanges(
  status: Status | null,
  error: string | null,
  loading: boolean,
  onOpenDiff: (path: string) => void,
  onRevert: (path: string) => void,
) {
  if (loading && !status) {
    return <Loading />;
  }
  if (error) {
    return <Empty icon={<GitBranch size={15} />} title={t("Git error")} detail={error} />;
  }
  if (status && !status.isRepo) {
    return (
      <Empty
        icon={<GitBranch size={15} />}
        title={t("Not a git repository")}
        detail={t("Changes are shown for Git projects.")}
      />
    );
  }
  if (!status || status.files.length === 0) {
    return (
      <Empty
        icon={<GitBranch size={15} />}
        title={t("No changes")}
        detail={t("Edits made by pi and your working tree changes appear here.")}
      />
    );
  }
  return (
    <ul className="space-y-0.5">
      {status.files.map((file) => (
        <li
          key={file.path}
          className="group flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-surface-2"
        >
          <button
            type="button"
            onClick={() => onOpenDiff(file.path)}
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded text-micro font-semibold",
                file.status === "??"
                  ? "bg-success/10 text-success"
                  : file.status === "D"
                    ? "bg-danger/10 text-danger"
                    : "bg-surface-3 text-subtle",
              )}
            >
              {file.status === "??" ? "U" : file.status}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-label text-subtle group-hover:text-fg">
                {file.path}
              </span>
              {file.oldPath ? (
                <span className="block truncate text-micro text-faint">
                  {t("from {path}", { path: file.oldPath })}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-micro tabular-nums text-faint">
              <span className="text-success">+{file.additions}</span>{" "}
              <span className="text-danger">−{file.deletions}</span>
            </span>
            {file.staged ? (
              <span className="size-1 rounded-full bg-brand" title={t("Staged")} />
            ) : null}
          </button>
          {file.status !== "??" ? (
            <button
              type="button"
              onClick={() => onRevert(file.path)}
              className="flex size-6 shrink-0 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
              aria-label={`Revert ${file.path}`}
              title={t("Revert to HEAD")}
            >
              <Undo2 size={11} />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function FileList({ files, onOpen }: { files: Hit[]; onOpen: (path: string) => void }) {
  if (files.length === 0) {
    return (
      <Empty
        icon={<FileText size={15} />}
        title={t("No files")}
        detail={t("No files match this project.")}
      />
    );
  }
  return (
    <ul className="space-y-0.5">
      {files.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            onClick={() => onOpen(file.path)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
          >
            <FileText size={11} className="shrink-0 text-faint" />
            <span className="truncate font-mono text-micro text-subtle">{file.path}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TodoList({ todos }: { todos: TodoItem[] }) {
  if (todos.length === 0) {
    return (
      <Empty
        icon={<ListTodo size={15} />}
        title={t("No plan yet")}
        detail={t("Plans and todo lists created by pi appear here.")}
      />
    );
  }
  return (
    <ul className="space-y-0.5 p-1">
      {todos.map((todo) => (
        <li
          key={todo.id}
          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-label leading-5"
        >
          {todo.done ? (
            <CircleCheck size={13} className="mt-0.5 shrink-0 text-success" />
          ) : (
            <Circle
              size={13}
              className={cn("mt-0.5 shrink-0", todo.active ? "text-brand-ink" : "text-faint")}
            />
          )}
          <span
            className={cn(
              "min-w-0 flex-1",
              todo.done ? "text-faint line-through" : todo.active ? "text-fg" : "text-subtle",
            )}
          >
            {todo.text}
          </span>
          {todo.active ? (
            <span className="shrink-0 text-micro uppercase tracking-label text-brand-ink">
              {t("now")}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SubagentList({ runs }: { runs: SubagentRun[] }) {
  if (runs.length === 0) {
    return (
      <Empty
        icon={<Users size={15} />}
        title={t("No subagents yet")}
        detail={t("Subagent activity from pi appears here.")}
      />
    );
  }
  return (
    <ul className="space-y-0.5 p-1">
      {runs.map((run) => (
        <li
          key={run.id}
          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-label leading-5"
        >
          {run.status === "running" ? (
            <Loader2 size={12} className="mt-1 shrink-0 animate-spin text-brand-ink" />
          ) : run.status === "error" ? (
            <CircleAlert size={13} className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <CircleCheck size={13} className="mt-0.5 shrink-0 text-success" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-subtle">{run.label}</span>
            {run.agent ? (
              <span className="mt-0.5 block truncate text-micro text-faint">{run.agent}</span>
            ) : null}
            {run.result ? (
              <span className="mt-0.5 line-clamp-2 block text-micro leading-4 text-faint">
                {run.result}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-micro uppercase tracking-label text-faint">
            {t(run.status)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-label text-faint">
      <Loader2 size={13} className="animate-spin" />
      {t("Reading changes…")}
    </div>
  );
}

function Empty({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-9 items-center justify-center rounded-xl border border-border bg-surface text-faint">
        {icon}
      </div>
      <div className="mt-3 text-label font-medium">{title}</div>
      <p className="mt-1 max-w-[240px] text-label leading-4 text-faint">{detail}</p>
    </div>
  );
}

function TabButton({
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
        "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-label font-medium transition-colors",
        active ? "bg-surface-3 text-fg" : "text-subtle hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
