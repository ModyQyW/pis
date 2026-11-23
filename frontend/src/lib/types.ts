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

export type PermissionPolicy = "smart" | "ask" | "allow";

export type RunState = "idle" | "working" | "needs-input" | "error" | "sleeping";
