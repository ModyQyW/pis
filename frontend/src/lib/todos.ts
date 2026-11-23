import type { Entry } from "../mygo";

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  active: boolean;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function stringValue(value: unknown, key: string): string {
  const source = record(value);
  const field = source?.[key];
  return typeof field === "string" ? field : "";
}

function tasksFrom(value: unknown): unknown[] | null {
  const source = record(value);
  const tasks = source?.["tasks"] ?? source?.["todos"];
  if (Array.isArray(tasks)) return tasks;
  const data = record(source?.["data"]);
  const nested = data?.["tasks"] ?? data?.["todos"];
  return Array.isArray(nested) ? nested : null;
}

/** Latest todo set from pi's custom todo state or a todo tool result. */
export function extractTodos(entries: Entry[]): TodoItem[] {
  let latest: unknown[] | null = null;
  for (const entry of entries) {
    const direct = tasksFrom(entry);
    if (direct) {
      latest = direct;
      continue;
    }
    const message = record(entry.message);
    const details = record(message?.["details"]);
    const fromDetails = tasksFrom(details);
    if (fromDetails) latest = fromDetails;
  }
  if (!latest) return [];

  const out: TodoItem[] = [];
  for (const [index, value] of latest.entries()) {
    const text = stringValue(value, "subject") || stringValue(value, "text");
    if (!text) continue;
    const status = stringValue(value, "status");
    const doneField = record(value)?.["done"];
    const done = status === "completed" || status === "done" || doneField === true;
    const id = stringValue(value, "id") || String(index + 1);
    out.push({
      id,
      text,
      done,
      active: status === "in_progress" || status === "active",
    });
  }
  return out;
}
