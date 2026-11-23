import { toast } from "../lib/toast";
import { create } from "zustand";

import type { Entry, Event, Model } from "../mygo";
import { api } from "../lib/api";
import {
  normalizeUsage,
  type Attachment,
  type CommandInfo,
  type ExtensionDialog,
  type ExtensionUIRequest,
  type ExtensionUIResponse,
  type PiEvent,
  type SessionStats,
} from "../lib/pi-types";
import {
  buildTranscript,
  type ChatItem,
  type LiveAssistant,
  type ToolRunView,
} from "../lib/transcript";

export type SessionStatus = "loading" | "ready" | "error" | "exited";

export type ChatSession = {
  key: string;
  appId?: string;
  path?: string;
  cwd: string;
  name: string;
  entries: Entry[];
  live: LiveAssistant | null;
  runs: Record<string, ToolRunView>;
  streaming: boolean;
  compacting: boolean;
  status: SessionStatus;
  error?: string;
  model?: Model | null;
  models: Model[];
  thinking?: string;
  thinkingLevels: string[];
  autoCompaction: boolean;
  draft: string;
  stats?: SessionStats;
  commands: CommandInfo[];
  queues: { steering: string[]; followUp: string[] };
  retry?: { attempt: number; maxAttempts: number; message?: string };
  attachments: Attachment[];
  dialogs: ExtensionDialog[];
  statuses: Record<string, string>;
  widgets: Record<string, string[]>;
  extensionTitle?: string;
  startedAt: number;
};

type Store = {
  sessions: Record<string, ChatSession>;
  activeKey: string | null;
  orphan: Record<string, Event[]>;
  setActive: (key: string | null) => void;
  openSummary: (input: {
    path: string;
    title: string;
    cwd: string;
    trusted: boolean;
  }) => Promise<void>;
  startNew: (input: { cwd: string; trusted: boolean }) => Promise<void>;
  close: (key: string) => Promise<void>;
  send: (key: string, text: string, behavior?: "steer" | "followUp") => Promise<void>;
  stop: (key: string) => Promise<void>;
  setDraft: (key: string, draft: string) => void;
  addAttachment: (key: string, attachment: Attachment) => void;
  removeAttachment: (key: string, id: string) => void;
  respondDialog: (key: string, dialogId: string, response: Omit<ExtensionUIResponse, "id">) => Promise<void>;
  refreshTranscript: (key: string, leafId?: string) => Promise<void>;
  fork: (key: string, entryId: string) => Promise<void>;
  clone: (key: string) => Promise<void>;
  navigateTree: (key: string, entryId: string, summarize: boolean) => Promise<void>;
  rename: (key: string, name: string) => Promise<void>;
  refreshModels: (key: string) => Promise<void>;
  chooseModel: (key: string, model: Model) => Promise<void>;
  chooseThinking: (key: string, level: string) => Promise<void>;
  setAutoCompaction: (key: string, enabled: boolean) => Promise<void>;
  togglePlan: (key: string) => Promise<void>;
  applyEvent: (ev: Event) => void;
  items: (key: string) => ChatItem[];
  activeSession: () => ChatSession | null;
};

const now = () => Date.now();

const DRAFT_PREFIX = "pi-mygo:draft:";
const LAST_SESSION = "pi-mygo:last-session";

function draftKey(session: ChatSession): string {
  return DRAFT_PREFIX + (session.path || session.appId || session.key);
}

function loadDraft(session: ChatSession): string {
  try {
    return localStorage.getItem(draftKey(session)) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(session: ChatSession, text: string) {
  try {
    if (text.trim()) localStorage.setItem(draftKey(session), text.slice(0, 200_000));
    else localStorage.removeItem(draftKey(session));
  } catch {
    // Drafts are a convenience; a full quota must not break sending.
  }
}

function emptySession(input: {
  key: string;
  cwd: string;
  name: string;
  path?: string;
}): ChatSession {
  const session: ChatSession = {
    key: input.key,
    cwd: input.cwd,
    name: input.name,
    path: input.path,
    entries: [],
    live: null,
    runs: {},
    streaming: false,
    compacting: false,
    status: "loading",
    draft: "",
    models: [],
    thinkingLevels: [],
    autoCompaction: true,
    commands: [],
    queues: { steering: [], followUp: [] },
    attachments: [],
    dialogs: [],
    statuses: {},
    widgets: {},
    startedAt: now(),
  };
  session.draft = loadDraft(session);
  return session;
}

export const useChat = create<Store>((set, get) => ({
  sessions: {},
  activeKey: null,
  orphan: {},

  setActive: (key) => set({ activeKey: key }),

  async openSummary({ path, title, cwd, trusted }) {
    const existing = Object.values(get().sessions).find((s) => s.path === path);
    if (existing) {
      set({ activeKey: existing.key });
      return;
    }
    const tempKey = `path:${path}`;
    if (get().sessions[tempKey]) {
      set({ activeKey: tempKey });
      return;
    }
    set((state) => ({
      sessions: {
        ...state.sessions,
        [tempKey]: { ...emptySession({ key: tempKey, cwd, name: title, path }), status: "loading" },
      },
      activeKey: tempKey,
    }));

    // Fast transcript first; pi starts in parallel.
    const readPromise = api.readSession(path).catch(() => null);
    const startPromise = api.startSession({ path, cwd, trusted });
    readPromise.then((tr) => {
      if (!tr) return;
      set((state) => {
        const s = state.sessions[tempKey];
        if (!s) return state;
        return {
          sessions: {
            ...state.sessions,
            [tempKey]: { ...s, entries: tr.entries, name: s.name || tr.name },
          },
        };
      });
    });

    try {
      const info = await startPromise;
      const transcript = await readPromise;
      set((state) => {
        const s = state.sessions[tempKey];
        if (!s) return state;
        const next: Record<string, ChatSession> = { ...state.sessions };
        delete next[tempKey];
        const session: ChatSession = {
          ...s,
          entries: s.entries.length > 0 ? s.entries : transcript?.entries ?? [],
          key: info.id,
          appId: info.id,
          path: info.file || path,
          name: info.name || s.name,
          draft: s.draft || loadDraft({ ...s, path: info.file || path }),
          model: info.model,
          thinking: info.thinkingLevel,
          autoCompaction: info.autoCompaction,
          models: s.models,
          thinkingLevels: s.thinkingLevels,
          streaming: info.streaming,
          compacting: info.compacting,
          status: "ready",
        };
        next[info.id] = session;
        try {
          if (session.path) localStorage.setItem(LAST_SESSION, session.path);
        } catch {
          // ignore
        }
        const orphan = state.orphan[info.id];
        if (orphan && orphan.length) {
          // Replay events emitted before the app id was known.
          delete state.orphan[info.id];
          for (const ev of orphan) queueMicrotask(() => get().applyEvent(ev));
        }
        return {
          sessions: next,
          activeKey: state.activeKey === tempKey ? info.id : state.activeKey,
        };
      });
      void loadModelData(set, info.id);
      void api.getCommands(info.id).then((raw) => {
        const commands = (raw as { commands?: CommandInfo[] } | null)?.commands ?? [];
        set((state) => {
          const s = state.sessions[info.id];
          if (!s) return state;
          return { sessions: { ...state.sessions, [info.id]: { ...s, commands } } };
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((state) => {
        const s = state.sessions[tempKey];
        if (!s) return state;
        return {
          sessions: {
            ...state.sessions,
            [tempKey]: { ...s, status: "error", error: message },
          },
        };
      });
    }
  },

  async startNew({ cwd, trusted }) {
    const tempKey = `new:${now()}`;
    set((state) => ({
      sessions: {
        ...state.sessions,
        [tempKey]: { ...emptySession({ key: tempKey, cwd, name: "New chat" }), status: "loading" },
      },
      activeKey: tempKey,
    }));
    try {
      const info = await api.startSession({ cwd, trusted });
      set((state) => {
        const s = state.sessions[tempKey];
        if (!s) return state;
        const next = { ...state.sessions };
        delete next[tempKey];
        next[info.id] = {
          ...s,
          key: info.id,
          appId: info.id,
          path: info.file,
          name: info.name || "New chat",
          draft: s.draft || loadDraft({ ...s, path: info.file }),
          model: info.model,
          thinking: info.thinkingLevel,
          autoCompaction: info.autoCompaction,
          models: s.models,
          thinkingLevels: s.thinkingLevels,
          streaming: info.streaming,
          compacting: info.compacting,
          status: "ready",
        };
        const orphan = state.orphan[info.id];
        if (orphan && orphan.length) {
          delete state.orphan[info.id];
          for (const ev of orphan) queueMicrotask(() => get().applyEvent(ev));
        }
        return {
          sessions: next,
          activeKey: state.activeKey === tempKey ? info.id : state.activeKey,
        };
      });
      void loadModelData(set, info.id);
      void api.getCommands(info.id).then((raw) => {
        const commands = (raw as { commands?: CommandInfo[] } | null)?.commands ?? [];
        set((state) => {
          const s = state.sessions[info.id];
          if (!s) return state;
          return { sessions: { ...state.sessions, [info.id]: { ...s, commands } } };
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((state) => {
        const s = state.sessions[tempKey];
        if (!s) return state;
        return {
          sessions: { ...state.sessions, [tempKey]: { ...s, status: "error", error: message } },
        };
      });
    }
  },

  async close(key) {
    const s = get().sessions[key];
    if (!s) return;
    if (s.appId) await api.closeSession(s.appId).catch(() => {});
    set((state) => {
      const next = { ...state.sessions };
      delete next[key];
      const keys = Object.keys(next);
      return { sessions: next, activeKey: keys[0] ?? null };
    });
  },

  async send(key, text, behavior) {
    const s = get().sessions[key];
    const images = (s?.attachments ?? [])
      .filter((a) => a.kind === "image" && a.data)
      .map((a) => ({ type: "image", data: a.data!, mimeType: a.mimeType }));
    const textFiles = (s?.attachments ?? []).filter((a) => a.kind === "text" && a.text);
    if (!s?.appId || (!text.trim() && images.length === 0)) return;
    const message =
      text +
      textFiles
        .map(
          (a) =>
            `\n\n<file name="${a.name}">\n${a.text}\n</file>`,
        )
        .join("");
    set((state) => {
      const cur = state.sessions[key];
      if (!cur) return state;
      try {
        localStorage.removeItem(draftKey(cur));
        localStorage.setItem(LAST_SESSION, cur.path ?? "");
      } catch {
        // ignore storage failures
      }
      return {
        sessions: {
          ...state.sessions,
          [key]: { ...cur, draft: "", attachments: [] },
        },
      };
    });
    try {
      await api.prompt({
        sessionId: s.appId,
        message,
        images: images.length ? images : undefined,
        behavior: s.streaming ? behavior ?? "steer" : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((state) => {
        const cur = state.sessions[key];
        if (!cur) return state;
        return { sessions: { ...state.sessions, [key]: { ...cur, error: message } } };
      });
    }
  },

  async stop(key) {
    const s = get().sessions[key];
    if (!s?.appId) return;
    await api.abortSession(s.appId).catch(() => {});
  },

  setDraft(key, draft) {
    set((state) => {
      const s = state.sessions[key];
      if (!s) return state;
      saveDraft(s, draft);
      return { sessions: { ...state.sessions, [key]: { ...s, draft } } };
    });
  },

  addAttachment(key, attachment) {
    set((state) => {
      const s = state.sessions[key];
      if (!s) return state;
      if (s.attachments.some((a) => a.id === attachment.id)) return state;
      return {
        sessions: {
          ...state.sessions,
          [key]: { ...s, attachments: [...s.attachments, attachment] },
        },
      };
    });
  },

  removeAttachment(key, id) {
    set((state) => {
      const s = state.sessions[key];
      if (!s) return state;
      return {
        sessions: {
          ...state.sessions,
          [key]: { ...s, attachments: s.attachments.filter((a) => a.id !== id) },
        },
      };
    });
  },

  async refreshTranscript(key, leafId) {
    const s = get().sessions[key];
    if (!s?.path) return;
    const tr = await api.readSessionAt(s.path, leafId ?? "");
    set((state) => {
      const cur = state.sessions[key];
      if (!cur) return state;
      return {
        sessions: {
          ...state.sessions,
          [key]: { ...cur, entries: tr.entries, name: cur.name || tr.name },
        },
      };
    });
  },

  async fork(key, entryId) {
    const s = get().sessions[key];
    if (!s?.appId) return;
    const info = await api.forkSession(s.appId, entryId);
    const tr = await api.readSession(info.file);
    set((state) => {
      const cur = state.sessions[key];
      if (!cur) return state;
      return {
        sessions: {
          ...state.sessions,
          [key]: {
            ...cur,
            path: info.file,
            name: info.name || "Forked chat",
            model: info.model,
            entries: tr.entries,
            live: null,
            streaming: info.streaming,
          },
        },
      };
    });
  },

  async clone(key) {
    const s = get().sessions[key];
    if (!s?.appId) return;
    const info = await api.cloneSession(s.appId);
    const tr = await api.readSession(info.file);
    set((state) => {
      const cur = state.sessions[key];
      if (!cur) return state;
      return {
        sessions: {
          ...state.sessions,
          [key]: {
            ...cur,
            path: info.file,
            name: info.name || cur.name,
            model: info.model,
            entries: tr.entries,
            live: null,
            streaming: info.streaming,
          },
        },
      };
    });
  },

  async navigateTree(key, entryId, summarize) {
    const s = get().sessions[key];
    if (!s?.appId) return;
    await api.navigateTree(s.appId, entryId, summarize);
    const raw = (await api.getEntries(s.appId)) as { leafId?: string } | null;
    await get().refreshTranscript(key, raw?.leafId ?? "");
  },

  async rename(key, name) {
    const s = get().sessions[key];
    if (!s?.appId || !name.trim()) return;
    await api.setName(s.appId, name.trim());
    set((state) => {
      const cur = state.sessions[key];
      if (!cur) return state;
      return { sessions: { ...state.sessions, [key]: { ...cur, name: name.trim() } } };
    });
  },

  async respondDialog(key, dialogId, response) {
    const s = get().sessions[key];
    if (!s?.appId) return;
    const dialog = s.dialogs.find((d) => d.id === dialogId);
    if (!dialog) return;
    try {
      await api.respondUI(s.appId, { id: dialogId, ...response });
      set((state) => {
        const cur = state.sessions[key];
        if (!cur) return state;
        return {
          sessions: {
            ...state.sessions,
            [key]: { ...cur, dialogs: cur.dialogs.filter((d) => d.id !== dialogId) },
          },
        };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  },

  async refreshModels(key) {
    const s = get().sessions[key];
    if (!s?.appId) return;
    await loadModelData(set, s.appId, key);
  },

  async chooseModel(key, model) {
    const s = get().sessions[key];
    if (!s?.appId) return;
    const next = await api.setModel(s.appId, model.provider, model.id);
    set((state) => {
      const cur = state.sessions[key];
      if (!cur) return state;
      return { sessions: { ...state.sessions, [key]: { ...cur, model: next } } };
    });
    const levels = await api.getThinkingLevels(s.appId).catch(() => []);
    set((state) => {
      const cur = state.sessions[key];
      if (!cur) return state;
      return { sessions: { ...state.sessions, [key]: { ...cur, thinkingLevels: levels } } };
    });
  },

  async chooseThinking(key, level) {
    const s = get().sessions[key];
    if (!s?.appId) return;
    await api.setThinking(s.appId, level);
    set((state) => {
      const cur = state.sessions[key];
      if (!cur) return state;
      return { sessions: { ...state.sessions, [key]: { ...cur, thinking: level } } };
    });
  },

  async togglePlan(key) {
    const s = get().sessions[key];
    if (!s?.appId) return;
    const on = s.statuses["mygo:plan"] !== "plan";
    await api.prompt({ sessionId: s.appId, message: `/mygo-plan ${on ? "on" : "off"}` });
  },

  async setAutoCompaction(key, enabled) {
    const s = get().sessions[key];
    if (!s?.appId) return;
    await api.setAutoCompaction(s.appId, enabled);
    set((state) => {
      const cur = state.sessions[key];
      if (!cur) return state;
      return { sessions: { ...state.sessions, [key]: { ...cur, autoCompaction: enabled } } };
    });
  },

  applyEvent(ev) {
    const state = get();
    let key = Object.keys(state.sessions).find((k) => state.sessions[k]?.appId === ev.sessionId);
    if (!key) {
      set((s) => ({
        orphan: {
          ...s.orphan,
          [ev.sessionId]: [...(s.orphan[ev.sessionId] ?? []), ev],
        },
      }));
      return;
    }
    const cur = state.sessions[key];
    if (!cur) return;

    if (ev.kind === "status") {
      if (ev.status === "exited") {
        set((s) => ({
          sessions: {
            ...s.sessions,
            [key]: { ...cur, status: "exited", streaming: false, error: ev.error || cur.error },
          },
        }));
      } else if (ev.status === "ready") {
        set((s) => ({
          sessions: { ...s.sessions, [key]: { ...cur, status: "ready" } },
        }));
      }
      return;
    }
    if (ev.kind === "text" || ev.kind === "thinking") {
      const live = updateLive(cur, ev.kind, ev.contentIndex ?? 0, ev.delta ?? "");
      set((s) => ({
        sessions: { ...s.sessions, [key]: { ...cur, live, streaming: true } },
      }));
      return;
    }
    if (ev.kind === "extension-ui") {
      const req = ev.raw as ExtensionUIRequest | undefined;
      if (!req || !req.id || !req.method) return;
      applyExtensionUI(key, cur, req);
      return;
    }
    if (ev.kind === "error") {
      set((s) => ({
        sessions: { ...s.sessions, [key]: { ...cur, error: ev.error || "pi error" } },
      }));
      return;
    }
    if (ev.kind !== "event" || !ev.raw) return;
    const event = ev.raw as PiEvent;
    const next = reduceEvent(cur, event);
    set((s) => ({ sessions: { ...s.sessions, [key]: next } }));
    if (event.type === "agent_settled" && cur.appId) {
      void api
        .getStats(cur.appId)
        .then((raw) => {
          const stats = raw as SessionStats | null;
          set((s) => {
            const latest = s.sessions[key];
            if (!latest || !stats) return s;
            return { sessions: { ...s.sessions, [key]: { ...latest, stats } } };
          });
        })
        .catch(() => {});
    }
  },

  items(key) {
    const s = get().sessions[key];
    if (!s) return [];
    return buildTranscript(s.entries, s.live, s.runs);
  },

  activeSession() {
    const { activeKey, sessions } = get();
    return activeKey ? sessions[activeKey] ?? null : null;
  },
}));

function updateLive(
  cur: ChatSession,
  kind: "text" | "thinking",
  index: number,
  delta: string,
): LiveAssistant {
  const live: LiveAssistant = cur.live
    ? { ...cur.live, blocks: [...cur.live.blocks] }
    : { blocks: [], startedAt: now(), model: cur.model?.id, provider: cur.model?.provider };
  const block = live.blocks[index];
  if (kind === "thinking") {
    if (!block || block.kind !== "thinking") {
      live.blocks[index] = { kind: "thinking", text: delta };
    } else {
      live.blocks[index] = { ...block, text: block.text + delta };
    }
  } else {
    if (!block || block.kind !== "text") {
      live.blocks[index] = { kind: "text", text: delta };
    } else {
      live.blocks[index] = { ...block, text: block.text + delta };
    }
  }
  return live;
}

function ensureLive(cur: ChatSession): LiveAssistant {
  return cur.live ?? {
    blocks: [],
    startedAt: now(),
    model: cur.model?.id,
    provider: cur.model?.provider,
  };
}

function reduceEvent(cur: ChatSession, event: PiEvent): ChatSession {
  switch (event.type) {
    case "agent_start":
    case "turn_start":
      return { ...cur, streaming: true, error: undefined };
    case "agent_settled":
      return { ...cur, streaming: false, retry: undefined };
    case "message_start": {
      const msg = event.message;
      if (msg.role === "assistant") {
        const live = ensureLive(cur);
        return {
          ...cur,
          live: {
            ...live,
            model: msg.model ?? live.model,
            provider: msg.provider ?? live.provider,
            usage: msg.usage ?? live.usage,
          },
        };
      }
      return cur;
    }
    case "message_end": {
      const msg = event.message;
      const normalized =
        msg.role === "assistant" ? { ...msg, usage: normalizeUsage(msg.usage) } : msg;
      const entry: Entry = {
        id: `live-${msg.timestamp ?? now()}-${cur.entries.length}`,
        type: "message",
        message: normalized,
        role: msg.role,
      };
      if (msg.role === "assistant") {
        const usage = normalizeUsage(msg.usage);
        return {
          ...cur,
          entries: [...cur.entries, entry],
          live: null,
          streaming:
            msg.stopReason === "stop" || msg.stopReason === "toolUse" ? cur.streaming : false,
          stats: usage
            ? {
                ...cur.stats,
                tokens: usage,
                cost: usage.cost?.total ?? 0,
              }
            : cur.stats,
          error: msg.stopReason === "error" ? msg.errorMessage ?? "model error" : cur.error,
        };
      }
      if (msg.role === "user") {
        return { ...cur, entries: [...cur.entries, entry], streaming: true };
      }
      return { ...cur, entries: [...cur.entries, entry] };
    }
    case "message_update": {
      const chunk = event.assistantMessageEvent;
      const live = ensureLive(cur);
      const next: LiveAssistant = {
        ...live,
        blocks: [...live.blocks],
        usage: normalizeUsage(event.usage) ?? live.usage,
      };
      const index = chunk.contentIndex ?? 0;
      switch (chunk.type) {
        case "text_start":
          next.blocks[index] = { kind: "text", text: "" };
          break;
        case "thinking_start":
          next.blocks[index] = { kind: "thinking", text: "" };
          break;
        case "text_end":
          next.blocks[index] = { kind: "text", text: chunk.content ?? textOf(next.blocks[index]) };
          break;
        case "thinking_end":
          next.blocks[index] = {
            kind: "thinking",
            text: chunk.content ?? textOf(next.blocks[index]),
          };
          break;
        case "toolcall_start": {
          if (chunk.id && chunk.toolName) {
            next.blocks[index] = {
              kind: "tool",
              id: chunk.id,
              name: chunk.toolName,
              args: {},
              run: cur.runs[chunk.id],
            };
          }
          break;
        }
        case "toolcall_end": {
          if (chunk.toolCall) {
            next.blocks[index] = {
              kind: "tool",
              id: chunk.toolCall.id,
              name: chunk.toolCall.name,
              args: chunk.toolCall.arguments,
              run: cur.runs[chunk.toolCall.id],
            };
          }
          break;
        }
        default:
          break;
      }
      return { ...cur, live: next };
    }
    case "tool_execution_start": {
      const runs = {
        ...cur.runs,
        [event.toolCallId]: {
          id: event.toolCallId,
          name: event.toolName,
          args: event.args ?? {},
          text: "",
          running: true,
        },
      };
      return { ...cur, runs, streaming: true };
    }
    case "tool_execution_update": {
      const prev = cur.runs[event.toolCallId];
      const text = partialText(event.partialResult);
      return {
        ...cur,
        runs: {
          ...cur.runs,
          [event.toolCallId]: {
            id: event.toolCallId,
            name: event.toolName,
            args: event.args ?? prev?.args ?? {},
            text: text || prev?.text || "",
            running: true,
          },
        },
      };
    }
    case "tool_execution_end": {
      const prev = cur.runs[event.toolCallId];
      const text = partialText(event.result) || prev?.text || "";
      return {
        ...cur,
        runs: {
          ...cur.runs,
          [event.toolCallId]: {
            id: event.toolCallId,
            name: event.toolName,
            args: prev?.args ?? {},
            text,
            isError: event.isError,
            running: false,
            durationMs: event.durationMs,
          },
        },
      };
    }
    case "queue_update":
      return { ...cur, queues: { steering: event.steering ?? [], followUp: event.followUp ?? [] } };
    case "session_info_changed":
      return { ...cur, name: event.name || cur.name };
    case "thinking_level_changed":
      return { ...cur, thinking: event.level };
    case "compaction_start":
      return { ...cur, compacting: true };
    case "compaction_end": {
      if (event.result) {
        const entry: Entry = {
          id: `compaction-${now()}`,
          type: "compaction",
          summary: event.result.summary,
          tokensBefore: event.result.tokensBefore,
          firstKeptEntryId: event.result.firstKeptEntryId,
        };
        return { ...cur, compacting: false, entries: [...cur.entries, entry] };
      }
      return {
        ...cur,
        compacting: false,
        error: event.errorMessage || (event.aborted ? "compaction aborted" : cur.error),
      };
    }
    case "auto_retry_start":
      return {
        ...cur,
        retry: {
          attempt: event.attempt,
          maxAttempts: event.maxAttempts,
          message: event.errorMessage,
        },
      };
    case "auto_retry_end":
      return { ...cur, retry: undefined, error: event.success ? undefined : event.finalError ?? cur.error };
    case "extension_error":
      return {
        ...cur,
        error: `${event.extensionPath ?? "extension"}: ${event.error ?? "error"}`,
      };
    default:
      return cur;
  }
}

function textOf(block: import("../lib/transcript").AssistantBlock | undefined): string {
  if (!block) return "";
  if (block.kind === "text" || block.kind === "thinking") return block.text;
  return "";
}

function partialText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (block && typeof block === "object" && (block as { type?: string }).type === "text") {
        return String((block as { text?: string }).text ?? "");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function activeItems(): ChatItem[] {
  const state = useChat.getState();
  return state.activeKey ? state.items(state.activeKey) : [];
}

function applyExtensionUI(key: string, cur: ChatSession, req: ExtensionUIRequest) {
  if (req.method === "notify") {
    const text = req.message ?? "";
    if (req.notifyType === "error") toast.error(text);
    else if (req.notifyType === "warning") toast.warning(text);
    else toast(text);
    return;
  }
  if (req.method === "setStatus") {
    const statuses = { ...cur.statuses };
    if (req.statusKey) {
      if (req.statusText) statuses[req.statusKey] = req.statusText;
      else delete statuses[req.statusKey];
    }
    useChat.setState((state) => ({
      sessions: { ...state.sessions, [key]: { ...cur, statuses } },
    }));
    return;
  }
  if (req.method === "setWidget") {
    const widgets = { ...cur.widgets };
    if (req.widgetKey) {
      if (req.widgetLines && req.widgetLines.length) widgets[req.widgetKey] = req.widgetLines;
      else delete widgets[req.widgetKey];
    }
    useChat.setState((state) => ({
      sessions: { ...state.sessions, [key]: { ...cur, widgets } },
    }));
    return;
  }
  if (req.method === "setTitle") {
    useChat.setState((state) => ({
      sessions: { ...state.sessions, [key]: { ...cur, extensionTitle: req.title } },
    }));
    return;
  }
  if (req.method === "set_editor_text") {
    useChat.setState((state) => ({
      sessions: { ...state.sessions, [key]: { ...cur, draft: req.text ?? "" } },
    }));
    return;
  }
  if (req.method === "select" || req.method === "confirm" || req.method === "input" || req.method === "editor") {
    const dialog = req as ExtensionDialog;
    if (cur.dialogs.some((d) => d.id === dialog.id)) return;
    useChat.setState((state) => {
      const latest = state.sessions[key];
      if (!latest) return state;
      return {
        sessions: {
          ...state.sessions,
          [key]: { ...latest, dialogs: [...latest.dialogs, dialog] },
        },
      };
    });
  }
}

async function loadModelData(
  set: (fn: (state: Store) => Partial<Store>) => void,
  appId: string,
  key = appId,
) {
  const [models, levels] = await Promise.all([
    api.getModels(appId).catch(() => []),
    api.getThinkingLevels(appId).catch(() => []),
  ]);
  set((state) => {
    const cur = state.sessions[key];
    if (!cur) return state;
    return { sessions: { ...state.sessions, [key]: { ...cur, models, thinkingLevels: levels } } };
  });
}
