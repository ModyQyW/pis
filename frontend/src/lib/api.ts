import { isMyGo } from "mygo-runtime";

import {
  Agent,
  Auth,
  Desktop,
  Files,
  Git,
  MCP,
  Sessions,
  events,
  type AddRequest,
  type Bootstrap,
  type Diagnostics,
  type Event,
  type MenuCommand,
  type PiStatus,
  type PromptRequest,
  type SearchHit,
  type Server,
  type SessionInfo,
  type StartRequest,
  type Summary,
  type Transcript,
  type Workspace,
  type Worktree,
} from "../mygo";
import { mockBootstrap, mockDiff, mockGitStatus, mockModels, mockStart, mockSummary, mockTranscript, mockTree } from "./mock";

/** True when the page is running inside the mygo shell. */
export const insideShell = isMyGo();

export const api = {
  async bootstrap(): Promise<Bootstrap> {
    if (!insideShell) return mockBootstrap();
    return Desktop.bootstrap();
  },
  async chooseProject(): Promise<Workspace | null> {
    if (!insideShell) return null;
    const ws = await Desktop.chooseProject();
    return ws.path ? ws : null;
  },
  async openProject(path: string): Promise<Workspace> {
    return Desktop.openProject(path);
  },
  async removeRecent(path: string): Promise<void> {
    if (!insideShell) return;
    await Desktop.removeRecent(path);
  },
  async workspaceTrust(workspace: string): Promise<import("../mygo").Info> {
    if (!insideShell) {
      return {
        path: workspace,
        requiresTrust: false,
        resources: [],
        decision: "trusted",
        source: "none",
        effective: true,
      };
    }
    return Desktop.workspaceTrust(workspace);
  },
  async setTrust(workspace: string, decision: string): Promise<import("../mygo").Info> {
    if (!insideShell) {
      return {
        path: workspace,
        requiresTrust: true,
        resources: [".pi/extensions"],
        decision,
        source: "app",
        effective: decision === "trusted",
      };
    }
    return Desktop.setTrust(workspace, decision);
  },
  async setTheme(theme: string): Promise<void> {
    if (!insideShell) return;
    await Desktop.setTheme(theme);
  },
  async setPreferences(p: import("../mygo").Preferences): Promise<void> {
    if (!insideShell) return;
    await Desktop.setPreferences(p);
  },
  async notify(id: string, title: string, body: string): Promise<void> {
    if (!insideShell) return;
    await Desktop.notify(id, title, body);
  },
  async setPiPath(path: string): Promise<PiStatus> {
    if (!insideShell) return mockBootstrap().pi;
    return Desktop.setPiPath(path);
  },
  async checkPi(): Promise<PiStatus> {
    if (!insideShell) return mockBootstrap().pi;
    return Desktop.checkPi();
  },
  async saveLayout(sidebar: number, right: number): Promise<void> {
    if (!insideShell) return;
    await Desktop.saveLayout(sidebar, right);
  },
  async diagnostics(): Promise<Diagnostics | null> {
    if (!insideShell) return null;
    return Desktop.diagnostics();
  },
  async openExternal(url: string): Promise<void> {
    if (!insideShell) return;
    await Desktop.openExternal(url);
  },
  async reveal(path: string): Promise<void> {
    if (!insideShell) return;
    await Desktop.reveal(path);
  },
  onMenuCommand(listener: (payload: MenuCommand) => void): () => void {
    if (!insideShell) return () => {};
    return events.menuCommand.on(listener);
  },
  onPiStatus(listener: (status: PiStatus) => void): () => void {
    if (!insideShell) return () => {};
    return events.piStatusChanged.on((p) => listener(p.status));
  },
  async listSessions(workspace: string, limit = 50): Promise<Summary[]> {
    if (!insideShell) return [mockSummary()];
    return Sessions.list(workspace, limit);
  },
  async searchSessions(workspace: string, query: string, limit = 12): Promise<SearchHit[]> {
    if (!insideShell) {
      const hit = mockSummary();
      return [{ ...hit, snippet: `…${query}…`, role: "assistant" }];
    }
    return Sessions.search(workspace, query, limit);
  },
  async readSession(path: string): Promise<Transcript> {
    if (!insideShell) return mockTranscript(path);
    return Sessions.read(path);
  },
  async summarySession(path: string): Promise<Summary> {
    if (!insideShell) return mockSummary();
    return Sessions.summary(path);
  },
  async readSessionAt(path: string, leafId: string): Promise<Transcript> {
    if (!insideShell) return mockTranscript(path);
    return Sessions.readAt(path, leafId);
  },
  async getTree(id: string): Promise<unknown> {
    if (!insideShell) return mockTree();
    return Agent.getTree(id);
  },
  async getEntries(id: string): Promise<unknown> {
    if (!insideShell) return { leafId: "a3", entries: [] };
    return Agent.getEntries(id);
  },
  async getForkMessages(id: string): Promise<unknown> {
    if (!insideShell) return { messages: [] };
    return Agent.getForkMessages(id);
  },
  async forkSession(id: string, entryId: string): Promise<SessionInfo> {
    if (!insideShell) return mockStart({ trusted: false });
    return Agent.fork(id, entryId);
  },
  async cloneSession(id: string): Promise<SessionInfo> {
    if (!insideShell) return mockStart({ trusted: false });
    return Agent.clone(id);
  },
  async navigateTree(id: string, entryId: string, summarize: boolean): Promise<void> {
    if (!insideShell) return;
    await Agent.navigateTree(id, entryId, summarize);
  },
  async setName(id: string, name: string): Promise<void> {
    if (!insideShell) return;
    await Agent.setName(id, name);
  },
  async exportSession(path: string): Promise<string> {
    if (!insideShell) return "/tmp/mock-session.html";
    return Sessions.exportHtml(path);
  },
  async deleteSession(path: string): Promise<void> {
    if (!insideShell) return;
    await Sessions.delete(path);
  },
  async revealSession(path: string): Promise<void> {
    if (!insideShell) return;
    await Sessions.reveal(path);
  },
  async startSession(req: StartRequest): Promise<SessionInfo> {
    if (!insideShell) return mockStart(req);
    return Agent.start(req);
  },
  async closeSession(id: string): Promise<void> {
    if (!insideShell) return;
    await Agent.close(id);
  },
  async prompt(req: PromptRequest): Promise<{ disposition: string }> {
    if (!insideShell) {
      return mockPrompt(req, mockEmit);
    }
    return Agent.prompt(req);
  },
  async abortSession(id: string): Promise<void> {
    if (!insideShell) {
      if (mockStream) clearInterval(mockStream);
      mockStream = undefined;
      mockEmit({ sessionId: id, kind: "event", raw: { type: "agent_settled", aborted: true } });
      return;
    }
    await Agent.abort(id);
  },
  async respondUI(sessionId: string, resp: import("../mygo").UIResponse): Promise<void> {
    if (!insideShell) return;
    await Agent.respondUI(sessionId, resp);
  },
  async compactSession(id: string): Promise<unknown> {
    if (!insideShell) return null;
    return Agent.compact(id);
  },
  async getModels(id: string): Promise<import("../mygo").Model[]> {
    if (!insideShell) return mockModels();
    return Agent.getModels(id);
  },
  async getThinkingLevels(id: string): Promise<string[]> {
    if (!insideShell) return ["off", "low", "medium", "high"];
    return Agent.getThinkingLevels(id);
  },
  async setModel(id: string, provider: string, model: string): Promise<import("../mygo").Model> {
    if (!insideShell) return mockModels()[0]!;
    return Agent.setModel(id, provider, model);
  },
  async setThinking(id: string, level: string): Promise<void> {
    if (!insideShell) return;
    await Agent.setThinking(id, level);
  },
  async setAutoCompaction(id: string, enabled: boolean): Promise<void> {
    if (!insideShell) return;
    await Agent.setAutoCompaction(id, enabled);
  },
  async mcpList(workspace: string): Promise<Server[]> {
    if (!insideShell) {
      return [
        {
          name: "filesystem",
          source: "user",
          kind: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
          description: "Project files",
          enabled: true,
        },
        {
          name: "docs",
          source: "project",
          kind: "http",
          url: "https://example.com/mcp",
          description: "Documentation search",
          enabled: false,
        },
      ];
    }
    return MCP.list(workspace);
  },
  async mcpSetEnabled(workspace: string, name: string, enabled: boolean, local: boolean): Promise<void> {
    if (!insideShell) return;
    await MCP.setEnabled(workspace, name, enabled, local);
  },
  async mcpRemove(workspace: string, name: string, local: boolean): Promise<void> {
    if (!insideShell) return;
    await MCP.remove(workspace, name, local);
  },
  async mcpAdd(workspace: string, req: AddRequest): Promise<void> {
    if (!insideShell) return;
    await MCP.add(workspace, req);
  },
  async gitStatus(workspace: string): Promise<import("../mygo").Status> {
    if (!insideShell) return mockGitStatus();
    return Git.status(workspace);
  },
  async gitDiff(workspace: string, path: string): Promise<string> {
    if (!insideShell) return mockDiff(path);
    return Git.diff(workspace, path);
  },
  async revertFile(workspace: string, path: string): Promise<void> {
    if (!insideShell) return;
    await Git.revert(workspace, path);
  },
  async worktrees(workspace: string): Promise<Worktree[]> {
    if (!insideShell) {
      return [
        { path: "/Users/you/Projects/atlas", branch: "main", head: "9f3c2a1" },
        { path: "/Users/you/Projects/atlas-feature", branch: "feature/cache", head: "2b7d9e0" },
      ];
    }
    return Git.worktrees(workspace);
  },
  async addWorktree(
    workspace: string,
    path: string,
    branch: string,
    createBranch: boolean,
  ): Promise<void> {
    if (!insideShell) return;
    await Git.addWorktree(workspace, path, branch, createBranch);
  },
  async removeWorktree(workspace: string, path: string, force: boolean): Promise<void> {
    if (!insideShell) return;
    await Git.removeWorktree(workspace, path, force);
  },
  async listFiles(workspace: string, limit = 300): Promise<import("../mygo").Hit[]> {
    if (!insideShell) {
      return [
        "src/cache/watch.ts",
        "src/cache/index.ts",
        "src/api/client.ts",
        "tests/cache.test.ts",
        "README.md",
      ].map((path) => ({ path, name: path.split("/").pop() ?? path }));
    }
    return Files.list(workspace, limit);
  },
  async readFile(workspace: string, path: string): Promise<import("../mygo").FileView> {
    if (!insideShell) {
      return {
        path,
        text: `// ${path}\n\nexport const demo = true;\n`,
        size: 42,
        truncated: false,
        binary: false,
      };
    }
    return Files.read(workspace, path, 512 * 1024);
  },
  async searchFiles(workspace: string, query: string, limit = 12): Promise<import("../mygo").Hit[]> {
    if (!insideShell) {
      const files = [
        "src/cache/watch.ts",
        "src/cache/index.ts",
        "src/api/client.ts",
        "tests/cache.test.ts",
        "README.md",
      ];
      return files
        .filter((f) => !query || f.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit)
        .map((path) => ({ path, name: path.split("/").pop() ?? path }));
    }
    return Files.search(workspace, query, limit);
  },
  async getStats(id: string): Promise<unknown> {
    if (!insideShell) return null;
    return Agent.getStats(id);
  },
  async getCommands(id: string): Promise<unknown> {
    if (!insideShell) {
      return {
        commands: [
          { name: "review", description: "Review the current changes", source: "prompt" },
          { name: "skill:frontend-design", description: "Apply the frontend design skill", source: "skill" },
          { name: "subagents", description: "Administer subagents", source: "extension" },
        ],
      };
    }
    return Agent.getCommands(id);
  },
  async startAuth(provider: string, apiKey: boolean): Promise<{ id: string; provider: string }> {
    if (!insideShell) {
      const id = `mock-login-${Date.now()}`;
      setTimeout(() => {
        for (const listener of mockAuthOutput) listener({ id, data: "Provider login (mock)\r\nPaste your key or complete the browser flow.\r\n> " });
      }, 150);
      return { id, provider };
    }
    return Auth.start(provider, apiKey);
  },
  async authWrite(id: string, data: string): Promise<void> {
    if (!insideShell) {
      for (const listener of mockAuthOutput) listener({ id, data: data === "\r" ? "\r\nDone.\r\n" : data });
      if (data === "\r") {
        for (const listener of mockAuthExit) listener({ id, code: 0 });
      }
      return;
    }
    await Auth.write(id, data);
  },
  async authResize(id: string, cols: number, rows: number): Promise<void> {
    if (!insideShell) return;
    await Auth.resize(id, cols, rows);
  },
  async authCancel(id: string): Promise<void> {
    if (!insideShell) return;
    await Auth.cancel(id);
  },
  onAuthOutput(listener: (o: import("../mygo").Output) => void): () => void {
    if (!insideShell) {
      mockAuthOutput.add(listener);
      return () => mockAuthOutput.delete(listener);
    }
    return events.authOutput.on(listener);
  },
  onAuthExit(listener: (o: import("../mygo").Exit) => void): () => void {
    if (!insideShell) {
      mockAuthExit.add(listener);
      return () => mockAuthExit.delete(listener);
    }
    return events.authExit.on(listener);
  },
  onAgentEvent(listener: (ev: Event) => void): () => void {
    if (!insideShell) {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    }
    return events.agentEvent.on(listener);
  },
};

const mockListeners = new Set<(ev: Event) => void>();
const mockAuthOutput = new Set<(o: import("../mygo").Output) => void>();
const mockAuthExit = new Set<(o: import("../mygo").Exit) => void>();
function mockEmit(ev: Event) {
  for (const listener of mockListeners) listener(ev);
}

let mockStream: ReturnType<typeof setInterval> | undefined;
function mockPrompt(req: PromptRequest, emit: (ev: Event) => void): { disposition: string } {
  if (req.message === "/mygo-plan on" || req.message === "/mygo-plan off") {
    emit({
      sessionId: req.sessionId,
      kind: "extension-ui",
      raw: {
        type: "extension_ui_request",
        id: `mock-plan-${Date.now()}`,
        method: "setStatus",
        statusKey: "mygo:plan",
        statusText: req.message.endsWith("on") ? "plan" : undefined,
      },
    });
    return { disposition: "handled" };
  }
  if (mockStream) clearInterval(mockStream);
  const sessionId = req.sessionId;
  const stamp = Date.now();
  emit({ sessionId, kind: "event", raw: { type: "agent_start" } });
  emit({
    sessionId,
    kind: "event",
    raw: {
      type: "message_end",
      message: { role: "user", content: req.message, timestamp: stamp },
    },
  });
  const text =
    "Here is the shape of the change I would make.\n\n```go\nfunc invalidateRename(oldPath, newPath string) {\n    cache.Delete(oldPath)\n    cache.Delete(newPath)\n}\n```\n\n```mermaid\nflowchart LR\n  A[Watcher] --> B[Cache]\n  B --> C{Rename?}\n  C -->|yes| D[Invalidate old + new]\n  C -->|no| E[Keep entry]\n```\n\n| Path | Cache result |\n| --- | --- |\n| old | invalidated |\n| new | reloaded |\n\nThe old path alone was not enough: the next read reused the stale entry under the new path. The lookup is $O(1)$ either way.";
  let i = 0;
  mockStream = setInterval(() => {
    if (i === 0) {
      emit({
        sessionId,
        kind: "event",
        raw: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "claude-sonnet-4-5", provider: "anthropic" },
        },
      });
    }
    const step = Math.max(2, Math.ceil(text.length / 90));
    const next = text.slice(i, i + step);
    i += step;
    if (next) emit({ sessionId, kind: "text", contentIndex: 0, delta: next });
    if (i >= text.length) {
      if (mockStream) clearInterval(mockStream);
      mockStream = undefined;
      emit({
        sessionId,
        kind: "event",
        raw: {
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text }],
            model: "claude-sonnet-4-5",
            provider: "anthropic",
            stopReason: "stop",
            timestamp: stamp + 1,
            usage: { input: 100, output: 80, cacheRead: 0, cacheWrite: 0, totalTokens: 180, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
          },
        },
      });
      emit({ sessionId, kind: "event", raw: { type: "agent_settled", aborted: false } });
    }
  }, 24);
  return { disposition: "started" };
}
