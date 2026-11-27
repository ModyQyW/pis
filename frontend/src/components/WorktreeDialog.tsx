import { FolderGit2, GitBranch, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import * as Dialog from "@/components/ui/dialog-compat";
import { CheckboxField } from "@/components/ui/checkbox";
import { DialogHeader, DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import { toast } from "../lib/toast";
import type { Worktree } from "../mygo";
import { ConfirmDialog } from "./ConfirmDialog";

export function WorktreeDialog({
  open,
  onOpenChange,
  workspace,
  onOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: string;
  onOpen: (path: string) => void;
}) {
  const [list, setList] = useState<Worktree[]>([]);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState("");
  const [branch, setBranch] = useState("");
  const [createBranch, setCreateBranch] = useState(true);
  const [remove, setRemove] = useState<Worktree | null>(null);
  const [forceRemove, setForceRemove] = useState<{ worktree: Worktree; error: string } | null>(
    null,
  );

  const load = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      setList(await api.worktrees(workspace));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
    // load reads the workspace and has no stable identity by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspace]);

  const add = async () => {
    if (!workspace || !path.trim()) return;
    try {
      await api.addWorktree(workspace, path.trim(), branch.trim(), createBranch);
      setPath("");
      setBranch("");
      await load();
      toast.success(t("Worktree created"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <DialogOverlay />
          <DialogSurface width="md">
            <DialogHeader
              icon={<FolderGit2 size={15} />}
              title={t("Worktrees")}
              description={t("Parallel checkouts for the same repository. Open one as a project.")}
              closeLabel={t("Close worktrees")}
            />

            <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-5 py-4">
              {!workspace ? (
                <p className="py-6 text-center text-label text-faint">
                  {t("Open a project first.")}
                </p>
              ) : loading && list.length === 0 ? (
                <div className="flex items-center gap-2 py-8 text-label text-faint">
                  <Loader2 size={13} className="animate-spin" />
                  {t("Reading worktrees…")}
                </div>
              ) : (
                <ul className="space-y-1">
                  {list.map((wt) => (
                    <li
                      key={wt.path}
                      className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2"
                    >
                      <GitBranch size={12} className="mt-0.5 shrink-0 text-faint" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-label font-medium">
                            {wt.branch || t(wt.detached ? "detached" : "worktree")}
                          </span>
                          {wt.locked ? (
                            <span className="text-micro text-warning">{t("locked")}</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-micro text-faint">{wt.path}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpen(wt.path)}
                        className="h-7 rounded-md border border-control px-2 text-micro text-subtle hover:bg-surface-2 hover:text-fg"
                      >
                        {t("Open")}
                      </button>
                      {list.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setRemove(wt)}
                          className="h-7 rounded-md px-1.5 text-micro text-faint hover:bg-danger/10 hover:text-danger"
                          title={t("Remove worktree")}
                        >
                          {t("Remove")}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {workspace ? (
                <>
                  <h3 className="mt-5 text-label font-semibold uppercase tracking-label text-faint">
                    {t("New worktree")}
                  </h3>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder={t("Absolute path")}
                      className="h-8 min-w-0 flex-1 rounded-md border border-control bg-canvas px-2.5 font-mono text-label outline-none placeholder:text-faint focus:border-brand"
                    />
                    <input
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder={createBranch ? t("new branch") : t("branch (optional)")}
                      className="h-8 w-[180px] rounded-md border border-control bg-canvas px-2.5 font-mono text-label outline-none placeholder:text-faint focus:border-brand"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <CheckboxField
                      checked={createBranch}
                      onCheckedChange={setCreateBranch}
                      className="flex items-center gap-1.5 text-micro text-subtle"
                      ariaLabel={t("Create branch")}
                    >
                      {t("Create branch")}
                    </CheckboxField>
                    <button
                      type="button"
                      disabled={!path.trim() || (createBranch && !branch.trim())}
                      onClick={() => void add()}
                      className="ml-auto h-7 rounded-md bg-primary px-2.5 text-micro font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
                    >
                      {t("Create worktree")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </DialogSurface>
        </Dialog.Portal>
      </Dialog.Root>
      <ConfirmDialog
        open={Boolean(remove)}
        onOpenChange={(next) => !next && setRemove(null)}
        title={t("Remove {branch}?", { branch: remove?.branch ?? "worktree" })}
        message={t(
          "The worktree directory is removed. Its branch and commits remain in the repository. Git refuses if the worktree has uncommitted files.",
        )}
        confirmLabel={t("Remove")}
        danger
        onConfirm={async () => {
          if (!workspace || !remove) return;
          try {
            await api.removeWorktree(workspace, remove.path, false);
            setRemove(null);
            await load();
          } catch (err) {
            setForceRemove({
              worktree: remove,
              error: err instanceof Error ? err.message : String(err),
            });
            setRemove(null);
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(forceRemove)}
        onOpenChange={(next) => !next && setForceRemove(null)}
        title={t("Discard uncommitted changes?")}
        message={t(
          "Git refused to remove this worktree: {error}\n\nForcing the removal deletes uncommitted files. The branch and committed work remain.",
          { error: forceRemove?.error ?? "" },
        )}
        confirmLabel={t("Force remove")}
        danger
        onConfirm={async () => {
          if (!workspace || !forceRemove) return;
          try {
            await api.removeWorktree(workspace, forceRemove.worktree.path, true);
            setForceRemove(null);
            await load();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        }}
      />
    </>
  );
}
