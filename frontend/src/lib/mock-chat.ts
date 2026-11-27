import type { Entry, SessionInfo, StartRequest, Summary, Transcript } from "../mygo";
import type { AgentMessage } from "./pi-types";

const now = Date.now();

export function mockTranscript(path: string): Transcript {
  const entries: Entry[] = [
    {
      id: "u1",
      type: "message",
      role: "user",
      timestamp: new Date(now - 1000 * 60 * 12).toISOString(),
      message: {
        role: "user",
        content:
          "The cache invalidation is wrong when a file is renamed. Can you find the cause and fix it?",
      } satisfies AgentMessage,
    },
    {
      id: "a1",
      type: "message",
      role: "assistant",
      timestamp: new Date(now - 1000 * 60 * 11).toISOString(),
      message: {
        role: "assistant",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        content: [
          {
            type: "thinking",
            thinking:
              "Renames surface as delete+add in the watcher. The cache keys by path, so the new path is missing until the directory scan.",
          },
          {
            type: "text",
            text: "I found it. The watcher treats a rename as a delete followed by an add, and the cache keys by absolute path. Let me confirm the event handling.",
          },
          {
            type: "toolCall",
            id: "call_1",
            name: "grep",
            arguments: { pattern: "rename|unlink|add", path: "src/cache" },
          },
        ],
        usage: {
          input: 18320,
          output: 214,
          cacheRead: 18200,
          cacheWrite: 0,
          totalTokens: 18534,
          cost: { input: 0.01, output: 0.01, cacheRead: 0.002, cacheWrite: 0, total: 0.022 },
        },
        stopReason: "toolUse",
        timestamp: now - 1000 * 60 * 11,
      } satisfies AgentMessage,
    },
    {
      id: "r1",
      type: "message",
      role: "toolResult",
      message: {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "grep",
        content: [
          {
            type: "text",
            text: 'src/cache/watch.ts:48:  if (event.kind === "rename") {\n    invalidate(event.oldPath)\n  }\nsrc/cache/watch.ts:61:  cache.set(event.path, entry)',
          },
        ],
        isError: false,
        durationMs: 42,
      } satisfies AgentMessage,
    },
    {
      id: "a2",
      type: "message",
      role: "assistant",
      message: {
        role: "assistant",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        content: [
          {
            type: "text",
            text: "The rename branch invalidates only `oldPath`; the new path is never populated. I'll invalidate both sides and let the next read repopulate.",
          },
          {
            type: "toolCall",
            id: "call_2",
            name: "edit",
            arguments: { path: "src/cache/watch.ts", edits: [] },
          },
        ],
        stopReason: "toolUse",
        timestamp: now - 1000 * 60 * 10,
      } satisfies AgentMessage,
    },
    {
      id: "r2",
      type: "message",
      role: "toolResult",
      message: {
        role: "toolResult",
        toolCallId: "call_2",
        toolName: "edit",
        content: [{ type: "text", text: "Updated src/cache/watch.ts" }],
        details: {
          diff: '@@ -45,7 +45,8 @@\n   if (event.kind === "rename") {\n     invalidate(event.oldPath)\n+    invalidate(event.path)\n   }',
          patch: "",
        },
        isError: false,
        durationMs: 18,
      } satisfies AgentMessage,
    },
    {
      id: "a3",
      type: "message",
      role: "assistant",
      message: {
        role: "assistant",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        content: [
          {
            type: "text",
            text: "Fixed. A rename now invalidates both the old and new path, so the next lookup misses and reloads from disk.\n\nI added a regression test that renames a cached file and asserts the new path is not served stale.",
          },
        ],
        stopReason: "stop",
        timestamp: now - 1000 * 60 * 9,
        usage: {
          input: 22100,
          output: 180,
          cacheRead: 21800,
          cacheWrite: 0,
          totalTokens: 22280,
          cost: { input: 0.012, output: 0.008, cacheRead: 0.002, cacheWrite: 0, total: 0.022 },
        },
      } satisfies AgentMessage,
    },
  ];
  return {
    path,
    id: "mock-session",
    cwd: "/Users/you/Projects/atlas",
    name: "Fix cache invalidation on rename",
    leafId: "a3",
    entries,
    truncated: false,
    context: { system: 1800, tools: 7400, skills: 900, project: 2200 },
  };
}

export function mockSummary(): Summary {
  return {
    path: "/Users/you/.pi/agent/sessions/--Users-you-Projects-atlas--/mock.jsonl",
    id: "mock-session",
    title: "Fix cache invalidation on rename",
    cwd: "/Users/you/Projects/atlas",
    createdAt: new Date(now - 1000 * 60 * 12).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 9).toISOString(),
  };
}

export function mockStart(req: StartRequest): SessionInfo {
  const existing = Boolean(req.path);
  return {
    id: existing ? "mock-session" : `mock-${Date.now()}`,
    piSessionId: "01MOCK",
    file: existing
      ? "/Users/you/.pi/agent/sessions/--Users-you-Projects-atlas--/mock.jsonl"
      : `/Users/you/.pi/agent/sessions/--Users-you-Projects-atlas--/new-${Date.now()}.jsonl`,
    cwd: req.cwd ?? "/Users/you/Projects/atlas",
    name: existing ? "Fix cache invalidation on rename" : "New chat",
    model: {
      id: "claude-sonnet-4-5",
      name: "Claude Sonnet 4.5",
      provider: "anthropic",
      api: "anthropic-messages",
      contextWindow: 200000,
      maxTokens: 16384,
      reasoning: true,
      input: ["text", "image"],
    },
    thinkingLevel: "medium",
    streaming: false,
    compacting: false,
    autoCompaction: true,
    messageCount: 6,
    startedAt: new Date().toISOString(),
  };
}

export function mockTree(): unknown {
  return {
    tree: [
      {
        entry: {
          id: "u1",
          type: "message",
          message: {
            role: "user",
            content: "The cache invalidation is wrong when a file is renamed.",
          },
        },
        children: [
          {
            entry: {
              id: "a1",
              type: "message",
              message: { role: "assistant", content: [{ type: "text", text: "I found it." }] },
            },
            children: [],
          },
        ],
      },
    ],
    leafId: "a3",
  };
}

export function mockModels() {
  const base = {
    api: "anthropic-messages",
    contextWindow: 200000,
    maxTokens: 16384,
    reasoning: true,
    input: ["text", "image"],
  };
  return [
    { ...base, id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "anthropic" },
    {
      ...base,
      id: "claude-opus-4-1",
      name: "Claude Opus 4.1",
      provider: "anthropic",
      contextWindow: 200000,
    },
    { ...base, id: "gpt-5.2", name: "GPT-5.2", provider: "openai", api: "openai-responses" },
    {
      ...base,
      id: "gemini-3-pro",
      name: "Gemini 3 Pro",
      provider: "google",
      api: "google-generative-ai",
    },
  ];
}

export function mockGitStatus() {
  return {
    isRepo: true,
    root: "/Users/you/Projects/atlas",
    branch: "fix/cache-rename",
    upstream: "origin/fix/cache-rename",
    ahead: 1,
    behind: 0,
    files: [
      {
        path: "src/cache/watch.ts",
        status: "M",
        staged: false,
        additions: 2,
        deletions: 0,
        binary: false,
      },
      {
        path: "tests/cache.test.ts",
        status: "M",
        staged: false,
        additions: 18,
        deletions: 1,
        binary: false,
      },
      {
        path: "src/cache/rename-fixture.ts",
        status: "??",
        staged: false,
        additions: 9,
        deletions: 0,
        binary: false,
      },
    ],
  };
}

export function mockDiff(_path: string) {
  return `@@ -45,7 +45,9 @@\n   if (event.kind === "rename") {\n     invalidate(event.oldPath)\n+    invalidate(event.newPath)\n+    cache.delete(event.newPath)\n   }\n\n@@ -60,4 +62,5 @@\n   cache.set(event.path, entry)\n+  // tests cover rename + invalidate\n }`;
}
