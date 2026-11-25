import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionInfo } from "../mygo";
import { useChat } from "./chat";

const mocks = vi.hoisted(() => ({
  prompt: vi.fn(),
  abortSession: vi.fn(),
  closeSession: vi.fn(),
  getModels: vi.fn(),
  getThinkingLevels: vi.fn(),
  getCommands: vi.fn(),
  getStats: vi.fn(),
  startSession: vi.fn(),
  readSession: vi.fn(),
  readSessionAt: vi.fn(),
  setName: vi.fn(),
  setModel: vi.fn(),
  setThinking: vi.fn(),
  setAutoCompaction: vi.fn(),
  forkSession: vi.fn(),
  cloneSession: vi.fn(),
  navigateTree: vi.fn(),
  getEntries: vi.fn(),
  respondUI: vi.fn(),
}));

vi.mock("../lib/api", () => ({ api: mocks }));
vi.mock("../lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn(), promise: vi.fn() },
}));

function info(id: string): SessionInfo {
  return {
    id,
    piSessionId: id,
    file: `/sessions/${id}.jsonl`,
    cwd: "/work",
    name: "Session",
    model: null,
    thinkingLevel: "medium",
    streaming: false,
    compacting: false,
    autoCompaction: true,
    messageCount: 0,
    startedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  useChat.setState({ sessions: {}, activeKey: null, orphan: {} });
  localStorage.clear();
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.closeSession.mockResolvedValue(undefined);
  mocks.abortSession.mockResolvedValue(undefined);
  mocks.getModels.mockResolvedValue([]);
  mocks.getThinkingLevels.mockResolvedValue([]);
  mocks.getCommands.mockResolvedValue({ commands: [] });
  mocks.readSession.mockResolvedValue({ entries: [], name: "" });
  mocks.readSessionAt.mockResolvedValue({ entries: [], name: "" });
});

describe("chat store", () => {
  it("restores the draft and attachments when a prompt fails", async () => {
    mocks.startSession.mockResolvedValue(info("send-1"));
    await useChat.getState().startNew({ cwd: "/work", trusted: false });
    const key = "send-1";
    useChat.getState().setDraft(key, "explain the cache");
    useChat.getState().addAttachment(key, {
      id: "a1",
      kind: "text",
      name: "notes.txt",
      mimeType: "text/plain",
      text: "notes",
      size: 5,
    });
    mocks.prompt.mockRejectedValueOnce(new Error("pi exited"));

    await useChat.getState().send(key, "explain the cache");

    const session = useChat.getState().sessions[key];
    expect(session?.draft).toBe("explain the cache");
    expect(session?.attachments).toHaveLength(1);
    expect(session?.error).toBe("pi exited");
  });

  it("closes a process that finishes starting after its tab was closed", async () => {
    const start = Promise.withResolvers<SessionInfo>();
    mocks.startSession.mockReturnValue(start.promise);

    const opening = useChat.getState().startNew({ cwd: "/work", trusted: false });
    const tempKey = Object.keys(useChat.getState().sessions)[0]!;
    await useChat.getState().close(tempKey);
    start.resolve(info("late-1"));
    await opening;

    expect(mocks.closeSession).toHaveBeenCalledWith("late-1");
    expect(useChat.getState().sessions["late-1"]).toBeUndefined();
  });

  it("drops late events from a closed session", async () => {
    mocks.startSession.mockResolvedValue(info("closed-1"));
    await useChat.getState().startNew({ cwd: "/work", trusted: false });
    await useChat.getState().close("closed-1");
    useChat.getState().applyEvent({
      sessionId: "closed-1",
      kind: "status",
      status: "exited",
    });
    expect(useChat.getState().orphan["closed-1"]).toBeUndefined();
  });

  it("dismisses a dialog without answering it", async () => {
    mocks.startSession.mockResolvedValue(info("dialog-1"));
    await useChat.getState().startNew({ cwd: "/work", trusted: false });
    useChat.getState().applyEvent({
      sessionId: "dialog-1",
      kind: "extension-ui",
      raw: {
        type: "extension_ui_request",
        id: "d1",
        method: "select",
        title: "Pick",
        options: ["A", "B"],
      },
    });
    expect(useChat.getState().sessions["dialog-1"]?.dialogs).toHaveLength(1);
    useChat.getState().dismissDialog("dialog-1", "d1");
    expect(useChat.getState().sessions["dialog-1"]?.dialogs).toHaveLength(0);
  });
});
