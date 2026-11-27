import type { AvailableModel, Snapshot as PiConfigSnapshot } from "../mygo";
import type { Bootstrap, PiStatus, Preferences, Settings } from "./types";

const now = Date.now();
const pi: PiStatus = {
  found: true,
  path: "/Users/you/.bun/bin/pi",
  version: "1.6.0",
  compatible: true,
  source: "PATH",
  checking: false,
};

let settings: Settings = {
  version: 3,
  theme: "system",
  palette: "amber",
  lastWorkspace: "/Users/you/Projects/atlas",
  recents: [],
  trust: {},
  permissions: { policy: "smart", disabled: false, force: false },
  showWidgets: false,
  notifications: true,
  codeFontSize: 13,
  uiFontSize: 14,
  sendOnEnter: true,
  language: "en",
};

/** Applies a Preferences patch so the browser preview reflects its own UI. */
export function setMockPreferences(p: Preferences): void {
  if (p.language) settings.language = p.language === "zh" ? "zh" : "en";
  if (typeof p.showWidgets === "boolean") settings.showWidgets = p.showWidgets;
  if (typeof p.notifications === "boolean") settings.notifications = p.notifications;
  if (p.palette) settings.palette = p.palette;
  if (typeof p.codeFontSize === "number") settings.codeFontSize = p.codeFontSize;
  if (typeof p.uiFontSize === "number") settings.uiFontSize = p.uiFontSize;
  if (typeof p.sendOnEnter === "boolean") settings.sendOnEnter = p.sendOnEnter;
  if (p.policy === "smart" || p.policy === "ask" || p.policy === "allow") {
    settings.permissions.policy = p.policy;
  }
  if (typeof p.guardDisabled === "boolean") settings.permissions.disabled = p.guardDisabled;
  if (typeof p.guardForce === "boolean") settings.permissions.force = p.guardForce;
}

/** A pi configuration for the browser-only UI dev server. */
export function mockPiConfig(): PiConfigSnapshot {
  return {
    agentDir: "/Users/you/.pi/agent",
    defaults: { provider: "magpie", model: "group/deepseek-flash", thinking: "high" },
    providers: [
      {
        id: "magpie",
        name: "Magpie",
        api: "openai-completions",
        baseUrl: "http://127.0.0.1:3425/v1",
        apiKeySet: true,
        apiKeyEnv: false,
        models: [
          {
            id: "group/deepseek-flash",
            name: "DeepSeek Flash · routing group",
            contextWindow: 1000000,
            maxTokens: 393216,
            reasoning: true,
          },
        ],
      },
    ],
    skills: [
      {
        name: "ste",
        description: "Write reports in Simplified Technical English.",
        path: "/Users/you/.pi/agent/skills/ste",
        source: "user",
        active: true,
      },
      {
        name: "repo-docs",
        description: "Write and audit README and CONTRIBUTING files.",
        path: "/Users/you/.pi/agent/skills/repo-docs",
        source: "user",
        active: true,
      },
      {
        name: "project-notes",
        description: "Project-specific release notes.",
        path: "/Users/you/Projects/atlas/.pi/skills/project-notes",
        source: "project",
        active: false,
      },
    ],
    extensions: [
      {
        name: "magpie",
        path: "/Users/you/.pi/agent/extensions/magpie.ts",
        source: "user",
        active: true,
      },
      {
        name: "local-tools",
        path: "/Users/you/Projects/atlas/.pi/extensions/local-tools.ts",
        source: "project",
        active: false,
      },
    ],
    packages: [
      { source: "npm:pi-subagents", project: false, active: true },
      { source: "npm:cc-safety-net", project: false, active: true },
    ],
    mcp: [
      {
        name: "docs",
        source: "user",
        kind: "http",
        url: "https://example.com/mcp",
        enabled: true,
      },
    ],
    trusted: false,
    fingerprint: "mock-pi-config",
  };
}

export function mockPiModels(): AvailableModel[] {
  return [
    { provider: "magpie", id: "group/deepseek-flash", context: "1.0M" },
    { provider: "deepseek", id: "deepseek-flash", context: "1M" },
    { provider: "openrouter", id: "anthropic/claude-sonnet-4.5", context: "1M" },
  ];
}

/** A believable first-run state for the browser-only UI dev server. */
export function mockBootstrap(): Bootstrap {
  const recents = [
    {
      path: "/Users/you/Projects/atlas",
      name: "atlas",
      lastOpened: new Date(now - 1000 * 60 * 18).toISOString(),
    },
    {
      path: "/Users/you/Projects/relay",
      name: "relay",
      lastOpened: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
    },
  ];
  return {
    appName: "PiS",
    appVersion: "0.1.0-dev",
    platform: "darwin",
    arch: "arm64",
    dataDir: "/Users/you/Library/Application Support/PiS",
    settings: { ...settings, permissions: { ...settings.permissions }, recents: [] },
    recents,
    pi,
    guard: {
      policy: settings.permissions.disabled ? "off" : settings.permissions.policy,
      detected: [],
      active: !settings.permissions.disabled && settings.permissions.policy !== "allow",
      force: settings.permissions.force,
      disabled: settings.permissions.disabled,
    },
  };
}

export const mockPiStatus: PiStatus = pi;
export const mockMenuCommand = (): void => {};
export {
  mockDiff,
  mockGitStatus,
  mockModels,
  mockStart,
  mockSummary,
  mockTranscript,
  mockTree,
} from "./mock-chat";
