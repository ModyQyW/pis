export type {
  Bootstrap,
  Diagnostics,
  MenuCommand,
  PiStatus,
  PiStatusChanged,
  Preferences,
  Settings,
  Theme,
  Workspace,
} from "../mygo";

export const PALETTES = ["amber", "graphite", "teal", "ink"] as const;

export type Palette = (typeof PALETTES)[number];

/** Narrows a persisted palette id; unknown values fall back to Amber. */
export function paletteOf(value: string | undefined | null): Palette {
  return PALETTES.includes(value as Palette) ? (value as Palette) : "amber";
}

export type PermissionPolicy = "smart" | "ask" | "allow";

export type RunState = "idle" | "working" | "needs-input" | "error" | "sleeping";
