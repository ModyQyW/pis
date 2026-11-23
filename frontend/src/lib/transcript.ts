import type { Entry } from "../mygo";
import { normalizeUsage, type AgentMessage, type ContentBlock, type ImageContent, type SessionStats, type Usage } from "./pi-types";

export type ToolResultView = {
  id: string;
  name: string;
  text: string;
  images: ImageContent[];
  details?: unknown;
  isError: boolean;
  durationMs?: number;
  usage?: Usage;
};

export type ToolRunView = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  text: string;
  isError?: boolean;
  running: boolean;
  durationMs?: number;
};

export type ToolBlock = {
  kind: "tool";
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: ToolResultView;
  run?: ToolRunView;
};

export type AssistantBlock =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string; redacted?: boolean }
  | { kind: "image"; image: ImageContent }
  | ToolBlock;

export type ChatItem =
  | {
      kind: "user";
      id: string;
      text: string;
      images: ImageContent[];
      timestamp?: string;
    }
  | {
      kind: "assistant";
      id: string;
      blocks: AssistantBlock[];
      model?: string;
      provider?: string;
      usage?: Usage;
      durationMs?: number;
      error?: string;
      live?: boolean;
    }
  | {
      kind: "tool";
      id: string;
      tool: ToolBlock;
    }
  | {
      kind: "compaction";
      id: string;
      summary: string;
      tokensBefore?: number;
    }
  | {
      kind: "branch";
      id: string;
      summary: string;
      fromId?: string;
    }
  | {
      kind: "note";
      id: string;
      text: string;
    };

export type LiveAssistant = {
  blocks: AssistantBlock[];
  startedAt: number;
  model?: string;
  provider?: string;
  usage?: Usage;
};

export function messageContent(msg: AgentMessage | null): ContentBlock[] {
  if (!msg) return [];
  if (msg.role === "user" || msg.role === "custom") {
    if (typeof msg.content === "string") return [{ type: "text", text: msg.content }];
    return msg.content as ContentBlock[];
  }
  if (msg.role === "assistant") return msg.content;
  if (msg.role === "toolResult") return msg.content as ContentBlock[];
  return [];
}

export function contentText(content: ContentBlock[]): string {
  return content
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export function imagesOf(content: ContentBlock[]): ImageContent[] {
  return content.filter((b): b is ImageContent => b.type === "image");
}

function isToolCall(block: ContentBlock): block is Extract<ContentBlock, { type: "toolCall" }> {
  return block.type === "toolCall";
}

function toolResultView(msg: AgentMessage): ToolResultView | null {
  if (msg.role !== "toolResult") return null;
  const content = msg.content;
  return {
    id: msg.toolCallId,
    name: msg.toolName,
    text: contentText(content),
    images: imagesOf(content),
    details: msg.details,
    isError: Boolean(msg.isError),
    durationMs: msg.durationMs,
    usage: normalizeUsage(msg.usage),
  };
}

function assistantBlocks(
  content: ContentBlock[],
  results: Map<string, ToolResultView>,
  runs: Record<string, ToolRunView>,
): AssistantBlock[] {
  const out: AssistantBlock[] = [];
  for (const block of content) {
    if (block.type === "text") out.push({ kind: "text", text: block.text });
    else if (block.type === "thinking")
      out.push({ kind: "thinking", text: block.thinking, redacted: block.redacted });
    else if (block.type === "image") out.push({ kind: "image", image: block });
    else if (isToolCall(block)) {
      out.push({
        kind: "tool",
        id: block.id,
        name: block.name,
        args: block.arguments ?? {},
        result: results.get(block.id),
        run: runs[block.id],
      });
    }
  }
  return out;
}

export function buildTranscript(
  entries: Entry[],
  live: LiveAssistant | null,
  runs: Record<string, ToolRunView> = {},
): ChatItem[] {
  const results = new Map<string, ToolResultView>();
  const paired = new Set<string>();
  for (const entry of entries) {
    if (entry.type !== "message" || !entry.message) continue;
    const msg = entry.message as AgentMessage;
    if (msg.role === "toolResult") {
      const view = toolResultView(msg);
      if (view) results.set(view.id, view);
    } else if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (isToolCall(block)) paired.add(block.id);
      }
    }
  }

  const items: ChatItem[] = [];
  for (const entry of entries) {
    switch (entry.type) {
      case "message": {
        if (!entry.message) break;
        const msg = entry.message as AgentMessage;
        if (msg.role === "user") {
          const content = messageContent(msg);
          items.push({
            kind: "user",
            id: entry.id,
            text: contentText(content),
            images: imagesOf(content),
            timestamp: entry.timestamp,
          });
        } else if (msg.role === "assistant") {
          const blocks = assistantBlocks(msg.content, results, runs);
          if (blocks.length > 0) {
            items.push({
              kind: "assistant",
              id: entry.id,
              blocks,
              model: msg.model,
              provider: msg.provider,
              usage: normalizeUsage(msg.usage),
              durationMs: msg.durationMs,
              error: msg.stopReason === "error" ? msg.errorMessage : undefined,
            });
          }
        } else if (msg.role === "toolResult") {
          if (!paired.has(msg.toolCallId)) {
            const view = results.get(msg.toolCallId);
            if (view) {
              items.push({
                kind: "tool",
                id: entry.id,
                tool: {
                  kind: "tool",
                  id: view.id,
                  name: view.name,
                  args: {},
                  result: view,
                },
              });
            }
          }
        }
        break;
      }
      case "compaction":
        items.push({
          kind: "compaction",
          id: entry.id,
          summary: entry.summary ?? "",
          tokensBefore: entry.tokensBefore,
        });
        break;
      case "branch_summary":
        items.push({
          kind: "branch",
          id: entry.id,
          summary: entry.summary ?? "",
          fromId: entry.fromId,
        });
        break;
      case "custom_message": {
        const msg = entry.message as AgentMessage | undefined;
        if (msg && (msg.role === "user" || msg.role === "custom")) {
          const content = messageContent(msg);
          items.push({ kind: "note", id: entry.id, text: contentText(content) });
        }
        break;
      }
      default:
        break;
    }
  }

  if (live && live.blocks.length > 0) {
    const blocks: AssistantBlock[] = live.blocks
      .filter((block): block is AssistantBlock => Boolean(block))
      .map((block) => {
      if (block.kind === "tool") {
        return {
          ...block,
          result: results.get(block.id) ?? block.result,
          run: runs[block.id] ?? block.run,
        };
      }
      return block;
    });
    items.push({
      kind: "assistant",
      id: `live-${live.startedAt}`,
      blocks,
      model: live.model,
      provider: live.provider,
      usage: live.usage,
      live: true,
    });
  }
  return items;
}

/** A short target for a tool row, derived from common argument shapes. */
export function toolTarget(name: string, args: Record<string, unknown>): string {
  const str = (key: string) => (typeof args[key] === "string" ? (args[key] as string) : "");
  switch (name) {
    case "bash":
      return str("command");
    case "read":
    case "write":
    case "edit":
      return str("path");
    case "grep":
    case "find":
      return [str("pattern"), str("path")].filter(Boolean).join("  ");
    case "ls":
      return str("path") || ".";
    case "todo":
      return str("action");
    case "ask_user_question": {
      const questions = Array.isArray(args.questions) ? args.questions.length : 0;
      return questions ? `${questions} question${questions === 1 ? "" : "s"}` : "";
    }
    case "subagent":
      return str("description") || str("agent") || "";
    default: {
      const first = Object.values(args).find((v) => typeof v === "string") as string | undefined;
      return first ?? "";
    }
  }
}

/** A compact label for usage in the header. */
export function usageLabel(usage?: Usage, stats?: SessionStats): string | null {
  if (stats?.contextUsage?.percent != null) {
    return `${Math.round(stats.contextUsage.percent)}%`;
  }
  if (!usage) return null;
  return `${Math.round(usage.totalTokens / 1000)}k`;
}
