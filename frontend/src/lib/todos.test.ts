import { describe, expect, it } from "vitest";

import type { Entry } from "../mygo";
import { extractTodos } from "./todos";

const entry = (id: string, data: unknown): Entry =>
  ({ id, type: "custom", customType: "rpiv-todo-state", data }) as Entry;

describe("extractTodos", () => {
  it("uses the latest todo state and normalizes status", () => {
    const todos = extractTodos([
      entry("a", {
        tasks: [
          { id: 1, subject: "Design", status: "completed" },
          { id: 2, subject: "Implement", status: "in_progress" },
        ],
      }),
      entry("b", {
        tasks: [
          { id: 1, subject: "Design", status: "completed" },
          { id: 2, subject: "Implement", status: "completed" },
          { id: 3, subject: "Verify", status: "pending" },
        ],
      }),
    ]);

    expect(todos).toEqual([
      { id: "1", text: "Design", done: true, active: false },
      { id: "2", text: "Implement", done: true, active: false },
      { id: "3", text: "Verify", done: false, active: false },
    ]);
  });

  it("reads todo details from a tool result", () => {
    const todos = extractTodos([
      {
        id: "result",
        type: "message",
        message: {
          role: "toolResult",
          toolName: "todo",
          details: { todos: [{ id: "x", text: "Ship", done: true }] },
        },
      } as Entry,
    ]);
    expect(todos).toEqual([{ id: "x", text: "Ship", done: true, active: false }]);
  });
});
