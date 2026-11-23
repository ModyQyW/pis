import type { Entry } from "../mygo";
import type { AssistantBlock } from "./transcript";

export type SubagentRun = {
  id: string;
  label: string;
  agent?: string;
  status: "running" | "complete" | "error";
  result?: string;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      const block = record(part);
      return block?.["type"] === "text" && typeof block["text"] === "string"
        ? block["text"]
        : "";
    })
    .filter(Boolean)
    .join("\n");
}

/** Extract subagent calls and their results from a transcript branch. */
export function extractSubagents(
  entries: Entry[],
  liveBlocks: AssistantBlock[] = [],
): SubagentRun[] {
  const calls = new Map<string, SubagentRun>();
  const results = new Map<string, { error: boolean; text: string }>();

  const scanBlocks = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    for (const value of blocks) {
      const block = record(value);
      if (!block || block["name"] !== "subagent") continue;
      const isCall = block["type"] === "toolCall";
      const isLive = block["kind"] === "tool";
      if (!isCall && !isLive) continue;
      const id = typeof block["id"] === "string" ? block["id"] : "";
      if (!id || calls.has(id)) continue;
      const args = record(block["arguments"]) ?? record(block["args"]) ?? {};
      const label =
        (typeof args["description"] === "string" && args["description"]) ||
        (typeof args["agent"] === "string" && args["agent"]) ||
        "Subagent";
      calls.set(id, {
        id,
        label,
        agent: typeof args["agent"] === "string" ? args["agent"] : undefined,
        status: "running",
      });
    }
  };

  for (const entry of entries) {
    if (entry.type === "message") {
      const message = record(entry.message);
      if (message?.["role"] === "assistant") scanBlocks(message["content"]);
      if (message?.["role"] === "toolResult") {
        const id = typeof message["toolCallId"] === "string" ? message["toolCallId"] : "";
        if (id) {
          results.set(id, {
            error: message["isError"] === true,
            text: textOf(message["content"]),
          });
        }
      }
    }
  }
  scanBlocks(liveBlocks);

  return [...calls.values()].map((run) => {
    const result = results.get(run.id);
    return result
      ? {
          ...run,
          status: result.error ? "error" : "complete",
          result: result.text || undefined,
        }
      : run;
  });
}
