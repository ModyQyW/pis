import { describe, expect, it } from "vitest";

import type { Entry } from "../mygo";
import type { AgentMessage } from "./pi-types";
import { normalizeUsage } from "./pi-types";
import { buildTranscript, toolTarget } from "./transcript";

function entry(id: string, message: AgentMessage): Entry {
  return { id, type: "message", role: (message as { role: string }).role, message };
}

describe("buildTranscript", () => {
  it("pairs tool calls with results and does not duplicate the result row", () => {
    const entries: Entry[] = [
      entry("u", { role: "user", content: "Fix it" }),
      entry("a", {
        role: "assistant",
        content: [
          { type: "text", text: "Looking" },
          { type: "toolCall", id: "c1", name: "bash", arguments: { command: "ls" } },
        ],
      }),
      entry("r", {
        role: "toolResult",
        toolCallId: "c1",
        toolName: "bash",
        content: [{ type: "text", text: "a.ts\n" }],
        isError: false,
      }),
    ];
    const items = buildTranscript(entries, null);
    expect(items.map((i) => i.kind)).toEqual(["user", "assistant"]);
    const assistant = items[1];
    if (assistant?.kind !== "assistant") throw new Error("missing assistant");
    const tool = assistant.blocks.find((b) => b.kind === "tool");
    expect(tool?.kind).toBe("tool");
    if (tool?.kind === "tool") {
      expect(tool.result?.text).toBe("a.ts\n");
      expect(toolTarget(tool.name, tool.args)).toBe("ls");
    }
  });

  it("renders an orphan tool result as its own row", () => {
    const entries: Entry[] = [
      entry("r", {
        role: "toolResult",
        toolCallId: "missing",
        toolName: "read",
        content: [{ type: "text", text: "x" }],
        isError: true,
      }),
    ];
    const items = buildTranscript(entries, null);
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("tool");
  });

  it("includes live tool blocks and compaction entries", () => {
    const entries: Entry[] = [
      { id: "cmp", type: "compaction", summary: "older work", tokensBefore: 50000 },
    ];
    const items = buildTranscript(entries, {
      startedAt: 1,
      blocks: [{ kind: "tool", id: "c1", name: "read", args: { path: "a.ts" } }],
    });
    expect(items.map((i) => i.kind)).toEqual(["compaction", "assistant"]);
  });

  it("renders background task notifications instead of raw XML", () => {
    const raw = [
      "<background-task-notification>",
      "<task-name>Build</task-name>",
      "<status>failed</status>",
      "<exit-code>1</exit-code>",
      "<error>Exited with code 1</error>",
      "</background-task-notification>",
    ].join("");
    const items = buildTranscript(
      [
        {
          id: "n1",
          type: "custom_message",
          customType: "background-task-notification",
          message: raw,
          data: { name: "Build", status: "failed", exitCode: 1, error: "Exited with code 1" },
        },
        {
          id: "n2",
          type: "custom_message",
          customType: "background-task-notification",
          message:
            "<background-task-notification><task-name>Docs &amp; site</task-name><status>killed</status></background-task-notification>",
        },
      ],
      null,
    );
    expect(items).toMatchObject([
      {
        kind: "notification",
        name: "Build",
        status: "failed",
        exitCode: 1,
        error: "Exited with code 1",
      },
      { kind: "notification", name: "Docs & site", status: "killed" },
    ]);
  });

  it("renders pi's custom_message content as a note", () => {
    const items = buildTranscript(
      [
        { id: "cm", type: "custom_message", message: "<task>failed</task>" },
        {
          id: "cm2",
          type: "custom_message",
          message: { role: "custom", content: [{ type: "text", text: "legacy note" }] },
        },
      ],
      null,
    );
    expect(items).toMatchObject([
      { kind: "note", text: "<task>failed</task>" },
      { kind: "note", text: "legacy note" },
    ]);
  });
});

describe("normalizeUsage", () => {
  it("fills a missing cost and total", () => {
    const usage = normalizeUsage({ input: 2, output: 3 });
    expect(usage?.totalTokens).toBe(5);
    expect(usage?.cost.total).toBe(0);
  });
  it("returns undefined for missing usage", () => {
    expect(normalizeUsage(undefined)).toBeUndefined();
  });
});
