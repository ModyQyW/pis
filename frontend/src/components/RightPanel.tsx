import {
  FileText,
  GitBranch,
  Loader2,
  PanelRightClose,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../lib/api";
import { cn } from "../lib/cn";
import type { Hit, Status } from "../mygo";
import type { ChatSession } from "../store/chat";
import type { Workspace } from "../lib/types";
import { DiffDialog } from "./DiffDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";

type Tab = "changes" | "files";

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

  useEffect(() => {
    if (!workspace) {
      setStatus(null);
      setFiles([]);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
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

  const changed = status?.files.length ?? 0;

  return (
    <aside className="flex w-[var(--right-width)] shrink-0 flex-col border-l border-border bg-surface/50">
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b border-border/70 px-2">
        <TabButton active={tab === "changes"} onClick={() => setTab("changes")}>
          <GitBranch size={12} />
          Changes
          {changed > 0 ? (
            <span className="ml-0.5 rounded-full bg-surface-3 px-1 text-[9px] tabular-nums text-subtle">
              {changed}
            </span>
          ) : null}
        </TabButton>
        <TabButton active={tab === "files"} onClick={() => setTab("files")}>
          <FileText size={12} />
          Files
        </TabButton>
        <button
          type="button"
          onClick={() => setRefresh((v) => v + 1)}
          className="ml-auto flex size-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="Refresh panel"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="Close panel"
          title="Close panel"
        >
          <PanelRightClose size={14} />
        </button>
      </div>

      {workspace ? (
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-[11px] text-subtle">
          <GitBranch size={11} className="text-faint" />
          <span className="truncate font-mono">{status?.branch || "—"}</span>
          {status?.ahead ? <span className="text-success">↑{status.ahead}</span> : null}
          {status?.behind ? <span className="text-warning">↓{status.behind}</span> : null}
          <span className="ml-auto truncate text-[10px] text-faint">
            {tab === "changes" ? `${changed} changed` : `${files.length} files`}
          </span>
        </div>
      ) : null}

      {tab === "files" ? (
        <div className="flex items-center gap-2 border-b border-border/60 px-3">
          <Search size={12} className="text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files…"
            className="h-8 min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-faint"
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-1.5">
        {!workspace ? (
          <Empty icon={<GitBranch size={15} />} title="No project" detail="Open a project to see changes." />
        ) : tab === "changes" ? (
          tabChanges(status, error, loading, setDiffPath)
        ) : (
          <FileList files={filteredFiles} onOpen={setFilePath} />
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
    </aside>
  );
}

function tabChanges(
  status: Status | null,
  error: string | null,
  loading: boolean,
  onOpenDiff: (path: string) => void,
) {
  if (loading && !status) {
    return <Loading />;
  }
  if (error) {
    return <Empty icon={<GitBranch size={15} />} title="Git error" detail={error} />;
  }
  if (status && !status.isRepo) {
    return (
      <Empty
        icon={<GitBranch size={15} />}
        title="Not a git repository"
        detail="Changes are shown for Git projects."
      />
    );
  }
  if (!status || status.files.length === 0) {
    return (
      <Empty
        icon={<GitBranch size={15} />}
        title="No changes"
        detail="Edits made by pi and your working tree changes appear here."
      />
    );
  }
  return (
    <ul className="space-y-0.5">
      {status.files.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            onClick={() => onOpenDiff(file.path)}
            className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded text-[9.5px] font-semibold",
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
              <span className="block truncate text-[11.5px] text-subtle group-hover:text-fg">
                {file.path}
              </span>
              {file.oldPath ? (
                <span className="block truncate text-[9.5px] text-faint">from {file.oldPath}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-faint">
              <span className="text-success">+{file.additions}</span>{" "}
              <span className="text-danger">−{file.deletions}</span>
            </span>
            {file.staged ? (
              <span className="size-1 rounded-full bg-brand" title="Staged" />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function FileList({ files, onOpen }: { files: Hit[]; onOpen: (path: string) => void }) {
  if (files.length === 0) {
    return <Empty icon={<FileText size={15} />} title="No files" detail="No files match this project." />;
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
            <span className="truncate font-mono text-[10.5px] text-subtle">{file.path}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[11px] text-faint">
      <Loader2 size={13} className="animate-spin" />
      Reading changes…
    </div>
  );
}

function Empty({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-9 items-center justify-center rounded-xl border border-border bg-surface text-faint">
        {icon}
      </div>
      <div className="mt-3 text-[12px] font-medium">{title}</div>
      <p className="mt-1 max-w-[240px] text-[11px] leading-4 text-faint">{detail}</p>
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
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors",
        active ? "bg-surface-3 text-fg" : "text-subtle hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
