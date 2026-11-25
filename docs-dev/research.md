# Research

[English](research.md) | [简体中文](research.zh.md)

This page records the research behind the PiS architecture and the measured facts that still guide decisions. It replaces the original research note. The accepted decisions are in [Decisions](decisions.md).

## Scope and method

Research date: 2026-11-22. The work inspected:

- `egoist/mygo` at `41f31d5`: Go desktop framework with a system webview and typed Go/TS IPC.
- `earendil-works/pi` at `9c46526`: agent, CLI, RPC, SDK, extensions, and packages.
- `JetBrains/thinkrail`, `vastsa/PI-Desktop`, `abcwyc/pi-agent-desktop`, and `bytesbay/pi-gpui`: desktop clients around pi.
- The installed pi 1.6.0 binary and the local `~/.pi/agent` configuration.

Live prototypes:

1. `pi --mode rpc` with a custom extension: session events, extension UI, permission blocking, and slash commands.
2. `pi --mode rpc --approve` in a project with a local extension.
3. A resumed 243-message, 566 KB session over RPC.
4. `pi auth login` under a pty.
5. A mygo hello binary: size and idle footprint.

## mygo

Facts:

- One Go binary. System webview. No bundled browser engine and no cgo.
- Typed IPC: Go services are bound, TypeScript calls them, events are batched per main-loop turn.
- Frontend assets are embedded. The app serves its own origin.
- Native window options include a hidden inset title bar, traffic-light position, vibrancy, background color, and window state.
- Desktop APIs include menus, dialogs, notifications, `Shell.OpenPath`, `Shell.TrashItem`, file watching, and a single-instance lock.

Measurements:

| Measurement | Result |
|---|---|
| `examples/hello` release binary | 9.5 MB |
| Idle physical footprint | 33 MB for the app process |
| Frontend load | Embedded assets, local origin |
| Idle CPU | 0% after settle |

Constraints:

- A trusted page must stay on the app origin. Do not render third-party HTML there.
- A macOS app opened from Finder gets a minimal `PATH`. PiS must find pi and node itself.
- WKWebView runs helper processes. Total memory includes them.
- PiS owns app state; mygo gives only window state.

Why this matters: the shell can be small and fast. The heavy part is pi and the model providers. A webview gives Markdown, code highlighting, virtual lists, and accessible dialogs without a bundled Chromium.

## pi and RPC

Facts:

- pi provides the agent loop, models, built-in tools, sessions, compaction, retries, MCP, codemode, and extensions.
- Extensions load from user and project directories, packages, or `-e`. They can register tools, commands, event hooks, TUI components, and `ctx.ui` prompts.
- RPC is a long-lived JSONL protocol over stdin/stdout. It supports prompt, steer, follow-up, abort, model and thinking selection, compaction, retry, session switch, fork, clone, tree reads, commands, stats, and export.
- The standalone pi binary is about 103 MB and needs no Node at runtime.
- Session files are append-only JSONL trees. Subagent runs live in nested directories.
- RPC cannot show pi's built-in project trust prompt. Without `--approve` or a saved trust decision, project resources do not load.
- Extension UI in RPC mode supports `select`, `confirm`, `input`, `editor`, `notify`, `setStatus`, `setWidget`, `setTitle`, and `set_editor_text`. It does not support `ctx.ui.custom()`, terminal input, custom editors, or theme switching.
- pi has no built-in permission system. An extension can intercept `tool_call` and ask through `ctx.ui`.
- `pi auth login <provider>` needs a terminal. A pty works.

| | RPC | TypeScript SDK |
|---|---|---|
| Extension compatibility | Exact pi process and load order | Host must reproduce the loader and UI bridge |
| Crash isolation | pi can die without killing the app | An extension crash can kill the host |
| Language | JSONL, usable from Go | TypeScript host required |
| Version coupling | Stable within pi 1.x | Internal SDK types change more often |
| Extension UI | Documented RPC subset | Host-specific bridge |
| Session and auth | pi owns both | Same, but the host wires more |

RPC is the only path that reuses existing extensions without reimplementing pi's loader, package manager, auth, and session machinery. The cost is the documented UI subset. PiS exposes that limit instead of faking TUI components.

Measured: a 243-message session took about 1.5 s for `get_messages` and returned 566 KB. That is why first paint reads the JSONL file directly and starts pi in parallel.

## Competitors

| Client | Strength | Lesson |
|---|---|---|
| pi-gpui | Closest architecture: one `pi --mode rpc` per session, JSONL sessions, small binary | Copy the principles and performance discipline, not the native-GPUI stack |
| pi-agent-desktop | Broad daily-driver feature set; reads existing pi data | Use the feature checklist; do not fork a web app or bundle a Node server |
| ThinkRail | Deep IDE features, specs, subagents, worktrees | Take high-leverage features; do not become an IDE |
| PI-Desktop | Permissions, plan approval, recovery, many ADRs | Use its ADRs as an edge-case checklist, not a scope template |
| pi-web | Mature browser UI for pi | A desktop shell can win on startup, native integration, and a calmer UI |

## Architecture choices

The research led to these choices. Details are in [Architecture and data flow](architecture.md) and [Decisions](decisions.md).

1. Use RPC, not the SDK.
2. Start one pi process per open session.
3. Ask for project trust in the app and pass `--approve` only after consent.
4. Draw first paint from JSONL; pi remains authoritative.
5. Stream deltas only; coalesce at 16 ms.
6. Use a bundled bridge for tree navigation, plan mode, approvals, and status.
7. Do not run an HTTP server in the app; use typed IPC and the app origin.
8. Let pi own sessions, credentials, models, and trust.

## Differentiation

PiS targets a fast, calm, native-feeling desktop client with real pi extension compatibility, strong streaming and tool rendering, and a safe default trust and approval model. It does not target IDE parity or plugin-platform breadth.

## Risks

| Risk | Mitigation |
|---|---|
| RPC UI subset breaks an extension | Support all RPC methods; explain TUI-only features; test with installed extensions |
| Extension noise floods the UI | Coalesce, strip ANSI, status cap, widgets opt-in |
| Trust silently disables project resources | App-side dialog, `--approve` only after consent, test ancestor skills |
| Resume blocks first paint | Read JSONL first; start pi in parallel |
| Streaming is O(n²) | Delta-only events and a 16 ms coalescer |
| Long sessions use too much memory | Virtual transcript and bounded reads |
| Finder `PATH` misses pi | Login-shell PATH lookup and an explicit path setting |
| Version drift | RPC, tested range, feature detection, clear diagnostics |
| Double approval prompts | Detect other guards; make the PiS guard optional |
| Auth terminal leaks secrets | Never log pty output; keep it in memory |

## Facts and inferences

Facts: repository contents, documented APIs, measured startup, payload, binary, and memory, reproduced trust behavior, reproduced approval, and reproduced pty login.

Inferences: user preference for a calm UI, the value of built-in plan mode, final app memory, and final frontend speed. The [Testing](testing.md) page and the performance budgets validate them.

## Related

- [Architecture and data flow](architecture.md)
- [Decisions](decisions.md)
- [Feature implementation](features.md)
- [Testing](testing.md)
