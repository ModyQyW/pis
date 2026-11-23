import type { Bootstrap, MenuCommand, PiStatus } from "./types";

const now = Date.now();
let mockLanguage: "en" | "zh" = "en";

export function setMockLanguage(value: string): void {
  mockLanguage = value === "zh" ? "zh" : "en";
}

/** A believable first-run state for the browser-only UI dev server. */
export function mockBootstrap(): Bootstrap {
  return {
    appName: "PiS",
    appVersion: "0.1.0-dev",
    platform: "darwin",
    arch: "arm64",
    dataDir: "/Users/you/Library/Application Support/PiS",
    settings: {
      version: 1,
      theme: "system",
      sidebarWidth: 280,
      rightWidth: 360,
      lastWorkspace: "/Users/you/Projects/atlas",
      recents: [
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
      ],
      trust: {},
      permissions: { policy: "smart", disabled: false, force: false },
      showWidgets: false,
      notifications: true,
      reduceMotion: false,
      codeFontSize: 13,
      uiFontSize: 14,
      sendOnEnter: true,
      checkUpdates: false,
      language: mockLanguage,
    },
    recents: [
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
    ],
    pi: {
      found: true,
      path: "/Users/you/.bun/bin/pi",
      version: "1.6.0",
      compatible: true,
      source: "PATH",
      checking: false,
    },
    guard: {
      policy: "smart",
      detected: [],
      active: true,
      force: false,
      disabled: false,
    },
  };
}

export const mockPiStatus: PiStatus = mockBootstrap().pi;
export const mockMenuCommand = (_: MenuCommand): void => {};
export { mockDiff, mockGitStatus, mockModels, mockStart, mockSummary, mockTranscript, mockTree } from "./mock-chat";
