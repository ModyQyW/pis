import { Loader2, Plus, Server, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import * as Dialog from "@/components/ui/dialog-compat";
import { DialogHeader, DialogOverlay, DialogSurface } from "@/components/ui/dialog-shell";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { t } from "../lib/i18n";
import { toast } from "../lib/toast";
import type { Server as MCPServer } from "../mygo";
import { ConfirmDialog } from "./ConfirmDialog";

export function MCPDialog({
  open,
  onOpenChange,
  workspace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: string;
}) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [local, setLocal] = useState(false);
  const [remove, setRemove] = useState<MCPServer | null>(null);

  const load = async () => {
    if (!workspace) return;
    setLoading(true);
    setError(null);
    try {
      setServers(await api.mcpList(workspace));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
    // load is intentionally tied to open/workspace; it is a local read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspace]);

  const add = async () => {
    if (!workspace || !name.trim()) return;
    try {
      await api.mcpAdd(workspace, {
        name: name.trim(),
        command: command.trim(),
        args: args.trim() ? args.trim().split(/\s+/) : [],
        url: url.trim(),
        description: description.trim(),
        local,
      });
      setName("");
      setCommand("");
      setArgs("");
      setUrl("");
      setDescription("");
      await load();
      toast.success(t("MCP server added"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <DialogOverlay />
          <DialogSurface width="lg">
            <DialogHeader
              icon={<Server size={15} />}
              title={t("MCP servers")}
              description={t("Edit pi's mcp.json. pi connects enabled servers at session start.")}
              closeLabel={t("Close MCP servers")}
            />

            <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-5 py-4">
              {!workspace ? (
                <p className="py-6 text-center text-label text-faint">
                  {t("Open a project first.")}
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-label font-semibold uppercase tracking-label text-faint">
                      {t("Configured")}
                    </h3>
                    <button
                      type="button"
                      onClick={() => void load()}
                      className="text-micro text-subtle hover:text-fg"
                    >
                      {t("Refresh")}
                    </button>
                  </div>
                  {loading && servers.length === 0 ? (
                    <div className="flex items-center gap-2 py-8 text-label text-faint">
                      <Loader2 size={13} className="animate-spin" />
                      {t("Reading mcp.json…")}
                    </div>
                  ) : error ? (
                    <p className="py-4 text-label leading-5 text-danger">{error}</p>
                  ) : servers.length === 0 ? (
                    <p className="py-4 text-label text-faint">{t("No MCP servers configured.")}</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {servers.map((server) => (
                        <li
                          key={`${server.source}:${server.name}`}
                          className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2"
                        >
                          <input
                            type="checkbox"
                            checked={server.enabled}
                            onChange={(e) =>
                              void api
                                .mcpSetEnabled(
                                  workspace,
                                  server.name,
                                  e.target.checked,
                                  server.source === "project",
                                )
                                .then(load)
                                .catch((err) =>
                                  toast.error(err instanceof Error ? err.message : String(err)),
                                )
                            }
                            className="mt-0.5 size-3.5 accent-[var(--brand)]"
                            aria-label={t("Enable {name}", { name: server.name })}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-label font-medium">{server.name}</span>
                              <span className="rounded bg-surface-3 px-1 py-0.5 text-micro text-subtle">
                                {server.source}
                              </span>
                              <span className="text-micro uppercase tracking-label text-faint">
                                {server.kind}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-micro text-faint">
                              {server.url || [server.command, ...(server.args ?? [])].join(" ")}
                            </p>
                            {server.description ? (
                              <p className="mt-0.5 text-micro text-subtle">{server.description}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => setRemove(server)}
                            className="flex size-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-danger/10 hover:text-danger"
                            aria-label={t("Remove {name}", { name: server.name })}
                            title={t("Remove")}
                          >
                            <Trash2 size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <h3 className="mt-5 text-label font-semibold uppercase tracking-label text-faint">
                    {t("Add a server")}
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("server name")}
                      className="h-8 rounded-md border border-control bg-canvas px-2.5 text-label outline-none placeholder:text-faint focus:border-brand"
                    />
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("description (optional)")}
                      className="h-8 rounded-md border border-control bg-canvas px-2.5 text-label outline-none placeholder:text-faint focus:border-brand"
                    />
                    <input
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder={t("command (stdio)")}
                      className="h-8 rounded-md border border-control bg-canvas px-2.5 font-mono text-label outline-none placeholder:text-faint focus:border-brand"
                    />
                    <input
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                      placeholder={t("arguments")}
                      className="h-8 rounded-md border border-control bg-canvas px-2.5 font-mono text-label outline-none placeholder:text-faint focus:border-brand"
                    />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={t("or URL (http)")}
                      className="col-span-2 h-8 rounded-md border border-control bg-canvas px-2.5 font-mono text-label outline-none placeholder:text-faint focus:border-brand"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-micro text-subtle">
                      <input
                        type="checkbox"
                        checked={local}
                        onChange={(e) => setLocal(e.target.checked)}
                        className="size-3.5 accent-[var(--brand)]"
                      />
                      {t("Project-local (.pi/mcp.json)")}
                    </label>
                    <button
                      type="button"
                      disabled={!name.trim() || (!command.trim() && !url.trim())}
                      onClick={() => void add()}
                      className="ml-auto flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-micro font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
                    >
                      <Plus size={11} />
                      {t("Add server")}
                    </button>
                  </div>
                  <p className={cn("mt-2 text-micro leading-4 text-faint")}>
                    {t(
                      "Environment variables, headers, OAuth, and tool exposure can be edited in mcp.json. Reload the session or run /mcp in pi after changes.",
                    )}
                  </p>
                </>
              )}
            </div>
          </DialogSurface>
        </Dialog.Portal>
      </Dialog.Root>
      <ConfirmDialog
        open={Boolean(remove)}
        onOpenChange={(next) => !next && setRemove(null)}
        title={t("Remove {name}?", { name: remove?.name ?? "MCP server" })}
        message={t(
          "This deletes the entry from mcp.json. It does not uninstall the server package.",
        )}
        confirmLabel={t("Remove")}
        danger
        onConfirm={async () => {
          if (!workspace || !remove) return;
          try {
            await api.mcpRemove(workspace, remove.name, remove.source === "project");
            setRemove(null);
            await load();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
          }
        }}
      />
    </>
  );
}
