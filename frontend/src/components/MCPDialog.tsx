import { Loader2, Plus, Server, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import * as Dialog from "@/components/ui/dialog-compat";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
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
      toast.success("MCP server added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(720px,calc(100vh-64px))] w-[min(720px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border-strong bg-surface shadow-2xl outline-none">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div>
                <Dialog.Title className="flex items-center gap-2 text-[14px] font-semibold">
                  <Server size={15} className="text-brand" />
                  MCP servers
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-[11px] text-faint">
                  Edit pi&apos;s mcp.json. pi connects enabled servers at session start.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
                  aria-label="Close MCP servers"
                >
                  <X size={15} />
                </button>
              </Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-5 py-4">
              {!workspace ? (
                <p className="py-6 text-center text-[11.5px] text-faint">Open a project first.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                      Configured
                    </h3>
                    <button
                      type="button"
                      onClick={() => void load()}
                      className="text-[10.5px] text-subtle hover:text-fg"
                    >
                      Refresh
                    </button>
                  </div>
                  {loading && servers.length === 0 ? (
                    <div className="flex items-center gap-2 py-8 text-[11px] text-faint">
                      <Loader2 size={13} className="animate-spin" />
                      Reading mcp.json…
                    </div>
                  ) : error ? (
                    <p className="py-4 text-[11px] leading-5 text-danger">{error}</p>
                  ) : servers.length === 0 ? (
                    <p className="py-4 text-[11px] text-faint">No MCP servers configured.</p>
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
                            aria-label={`Enable ${server.name}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11.5px] font-medium">{server.name}</span>
                              <span className="rounded bg-surface-3 px-1 py-0.5 text-[9px] text-faint">
                                {server.source}
                              </span>
                              <span className="text-[9px] uppercase tracking-wide text-faint">
                                {server.kind}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-[10px] text-faint">
                              {server.url || [server.command, ...(server.args ?? [])].join(" ")}
                            </p>
                            {server.description ? (
                              <p className="mt-0.5 text-[10.5px] text-subtle">{server.description}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => setRemove(server)}
                            className="flex size-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-danger/10 hover:text-danger"
                            aria-label={`Remove ${server.name}`}
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                    Add a server
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="server name"
                      className="h-8 rounded-md border border-border bg-canvas px-2.5 text-[11px] outline-none placeholder:text-faint focus:border-border-strong"
                    />
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="description (optional)"
                      className="h-8 rounded-md border border-border bg-canvas px-2.5 text-[11px] outline-none placeholder:text-faint focus:border-border-strong"
                    />
                    <input
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="command (stdio)"
                      className="h-8 rounded-md border border-border bg-canvas px-2.5 font-mono text-[11px] outline-none placeholder:text-faint focus:border-border-strong"
                    />
                    <input
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                      placeholder="arguments"
                      className="h-8 rounded-md border border-border bg-canvas px-2.5 font-mono text-[11px] outline-none placeholder:text-faint focus:border-border-strong"
                    />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="or URL (http)"
                      className="col-span-2 h-8 rounded-md border border-border bg-canvas px-2.5 font-mono text-[11px] outline-none placeholder:text-faint focus:border-border-strong"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[10.5px] text-subtle">
                      <input
                        type="checkbox"
                        checked={local}
                        onChange={(e) => setLocal(e.target.checked)}
                        className="size-3.5 accent-[var(--brand)]"
                      />
                      Project-local (.pi/mcp.json)
                    </label>
                    <button
                      type="button"
                      disabled={!name.trim() || (!command.trim() && !url.trim())}
                      onClick={() => void add()}
                      className="ml-auto flex h-7 items-center gap-1.5 rounded-md bg-brand px-2.5 text-[10.5px] font-medium text-brand-fg hover:opacity-90 disabled:opacity-40"
                    >
                      <Plus size={11} />
                      Add server
                    </button>
                  </div>
                  <p className={cn("mt-2 text-[10px] leading-4 text-faint")}>
                    Environment variables, headers, OAuth, and tool exposure can be edited
                    in mcp.json. Reload the session or run <code>/mcp</code> in pi after changes.
                  </p>
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ConfirmDialog
        open={Boolean(remove)}
        onOpenChange={(next) => !next && setRemove(null)}
        title={`Remove ${remove?.name ?? "MCP server"}?`}
        message="This deletes the entry from mcp.json. It does not uninstall the server package."
        confirmLabel="Remove"
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
