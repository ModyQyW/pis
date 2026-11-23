import { describe, expect, it } from "vitest";

import type { Entry } from "../mygo";
import { extractSubagents } from "./subagents";

const call = (id: string, description: string): Entry =>
  ({
    id,
    type: "message",
    message: {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id,
          name: "subagent",
          arguments: { description, agent: "worker" },
        },
      ],
    },
  }) as Entry;

const result = (toolCallId: string, text: string, isError = false): Entry =>
  ({
    id: `${toolCallId}-result`,
    type: "message",
    message: { role: "toolResult", toolCallId, isError, content: [{ type: "text", text }] },
  }) as Entry;

describe("extractSubagents", () => {
  it("pairs calls with results and marks running calls", () => {
    const runs = extractSubagents([
      call("a", "Review parser"),
      result("a", "Looks good"),
      call("b", "Add tests"),
    ]);
    expect(runs).toEqual([
      { id: "a", label: "Review parser", agent: "worker", status: "complete", result: "Looks good" },
      { id: "b", label: "Add tests", agent: "worker", status: "running" },
    ]);
  });

  it("includes a live call before its result exists", () => {
    const runs = extractSubagents([], [
      {
        kind: "tool",
        id: "live",
        name: "subagent",
        args: { description: "Investigate" },
      },
    ]);
    expect(runs).toEqual([
      { id: "live", label: "Investigate", agent: undefined, status: "running" },
    ]);
  });
});
