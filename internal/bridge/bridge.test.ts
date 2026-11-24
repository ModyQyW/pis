/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Handler = (event: any, ctx: any) => any;

async function loadBridge() {
  process.env.PIS_GUARD = "smart";
  process.env.PIS_WORKSPACE = "/tmp";
  const handlers = new Map<string, Handler>();
  const commands = new Map<string, Handler>();
  const activeTools: string[] = [];
  const pi = {
    registerCommand(name: string, spec: { handler: Handler }) {
      commands.set(name, spec.handler);
    },
    on(name: string, handler: Handler) {
      handlers.set(name, handler);
    },
    getActiveTools: () => ["bash", "read"],
    setActiveTools: (tools: string[]) => activeTools.splice(0, activeTools.length, ...tools),
    appendEntry() {},
  };
  const mod = await import("./bridge");
  mod.default(pi as ExtensionAPI);
  return { handlers, commands, activeTools };
}

function context(prompt: (title: string) => void) {
  return {
    hasUI: true,
    ui: {
      setStatus() {},
      notify() {},
      select: async (title: string) => {
        prompt(title);
        return "Deny";
      },
    },
    sessionManager: { getBranch: () => [] },
    waitForIdle: async () => {},
  };
}

describe("bridge guard", () => {
  it("labels destructive shell commands instead of throwing", async () => {
    const { handlers } = await loadBridge();
    let prompt = "";
    const result = await handlers.get("tool_call")!(
      { toolName: "bash", input: { command: "rm -rf /" } },
      context((title) => {
        prompt = title;
      }),
    );
    expect(prompt).toContain("recursive file removal");
    expect(result).toEqual({ block: true, reason: "Denied by the user." });
  });

  it("blocks mutating commands in plan mode", async () => {
    const { handlers, commands } = await loadBridge();
    const ctx = context(() => {});
    await commands.get("pis-plan")!("on", ctx);
    const result = await handlers.get("tool_call")!(
      { toolName: "bash", input: { command: "mkdir /tmp/example" } },
      ctx,
    );
    expect(result.block).toBe(true);
    expect(result.reason).toContain("Plan mode");
  });
});
