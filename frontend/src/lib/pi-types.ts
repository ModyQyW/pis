import type { Entry, Model, SessionInfo, SessionState } from "../mygo";

export type { Entry, Model, SessionInfo, SessionState };

export type TextContent = { type: "text"; text: string };
export type ThinkingContent = { type: "thinking"; thinking: string; redacted?: boolean };
export type ImageContent = { type: "image"; data: string; mimeType: string };
export type ToolCallContent = {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};
export type ContentBlock = TextContent | ThinkingContent | ImageContent | ToolCallContent;

export type Usage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
};

export type AgentMessage =
  | {
      role: "user";
      content: string | (TextContent | ImageContent)[];
      timestamp?: number;
    }
  | {
      role: "assistant";
      content: ContentBlock[];
      provider?: string;
      model?: string;
      stopReason?: string;
      errorMessage?: string;
      usage?: Usage;
      timestamp?: number;
      durationMs?: number;
    }
  | {
      role: "toolResult";
      toolCallId: string;
      toolName: string;
      content: (TextContent | ImageContent)[];
      details?: unknown;
      isError?: boolean;
      durationMs?: number;
      usage?: Usage;
      timestamp?: number;
    }
  | {
      role: "custom";
      content: string | (TextContent | ImageContent)[];
      customType?: string;
      display?: boolean;
      details?: unknown;
      timestamp?: number;
    }
  | {
      role: "system";
      content: unknown;
      timestamp?: number;
    };

export type AssistantChunk = {
  type: string;
  contentIndex?: number;
  delta?: string;
  content?: string;
  id?: string;
  toolName?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  };
};

export type PiEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; willRetry?: boolean }
  | { type: "agent_settled"; aborted?: boolean }
  | { type: "turn_start" }
  | { type: "turn_end" }
  | { type: "message_start"; message: AgentMessage }
  | {
      type: "message_update";
      usage?: Usage;
      assistantMessageEvent: AssistantChunk;
    }
  | { type: "message_end"; message: AgentMessage }
  | {
      type: "tool_execution_start";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool_execution_update";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      partialResult?: unknown;
    }
  | {
      type: "tool_execution_end";
      toolCallId: string;
      toolName: string;
      result?: unknown;
      isError?: boolean;
      durationMs?: number;
    }
  | { type: "queue_update"; steering: string[]; followUp: string[] }
  | { type: "session_info_changed"; name?: string }
  | { type: "thinking_level_changed"; level: string }
  | { type: "compaction_start"; reason: string }
  | {
      type: "compaction_end";
      reason: string;
      result?: {
        summary: string;
        tokensBefore: number;
        firstKeptEntryId?: string;
        estimatedTokensAfter?: number;
      };
      aborted?: boolean;
      errorMessage?: string;
    }
  | {
      type: "auto_retry_start";
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      errorMessage?: string;
    }
  | { type: "auto_retry_end"; success: boolean; finalError?: string }
  | { type: "extension_error"; extensionPath?: string; event?: string; error?: string }
  | { type: "entry_appended"; entry?: Entry };

export type CommandInfo = {
  name: string;
  description?: string;
  source: string;
  sourceInfo?: {
    path?: string;
    source?: string;
    scope?: string;
    origin?: string;
    baseDir?: string;
  };
};

export type SessionStats = {
  sessionFile?: string;
  sessionId?: string;
  userMessages?: number;
  assistantMessages?: number;
  toolCalls?: number;
  toolResults?: number;
  totalMessages?: number;
  tokens?: Usage;
  cost?: number;
  contextUsage?: {
    tokens: number | null;
    contextWindow: number;
    percent: number | null;
  };
};

export type ModelInfo = Model;

export type ExtensionUIRequest = {
  type: "extension_ui_request";
  id: string;
  method: string;
  title?: string;
  message?: string;
  options?: string[];
  placeholder?: string;
  prefill?: string;
  timeout?: number;
  notifyType?: "info" | "warning" | "error";
  statusKey?: string;
  statusText?: string;
  widgetKey?: string;
  widgetLines?: string[];
  widgetPlacement?: string;
  text?: string;
};

export type ExtensionDialog = ExtensionUIRequest & {
  method: "select" | "confirm" | "input" | "editor";
};

export type ExtensionUIResponse = {
  id: string;
  value?: string;
  confirmed?: boolean;
  cancelled?: boolean;
};

/** Normalizes a provider usage object; agents and older sessions vary. */
export function normalizeUsage(raw: unknown): Usage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = raw as Partial<Usage> & { cost?: Partial<Usage["cost"]> };
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const input = num(u.input);
  const output = num(u.output);
  const cacheRead = num(u.cacheRead);
  const cacheWrite = num(u.cacheWrite);
  const totalTokens = num(u.totalTokens) || input + output + cacheRead + cacheWrite;
  const c: Partial<Usage["cost"]> = u.cost ?? {};
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    totalTokens,
    cost: {
      input: num(c.input),
      output: num(c.output),
      cacheRead: num(c.cacheRead),
      cacheWrite: num(c.cacheWrite),
      total: num(c.total),
    },
  };
}

export type Attachment = {
  id: string;
  kind: "image" | "text";
  name: string;
  mimeType: string;
  /** base64 for images */
  data?: string;
  /** UTF-8 text for text files */
  text?: string;
  size: number;
};
