# Research: building a desktop coding agent on mygo + pi

Status: research complete, product decisions awaiting confirmation.
Date: 2026-11-22.

This document records what was inspected, what was measured, and which conclusions
are facts versus inferences. It is the source for the proposed decisions in
`01-decisions.md` and the plan in `02-plan.md`.

## 1. Scope and method

Inspected repositories (shallow clones, latest `main` on 2026-11-22):

| Repository | Commit inspected | What it is |
|---|---|---|
| `egoist/mygo` | `41f31d5` | Go desktop framework: system webview + typed Go/TS IPC, or native UI |
| `earendil-works/pi` | `9c46526` | Agent harness, CLI, RPC, SDK, extensions, packages |
| `JetBrains/thinkrail` | `7b4817a` | Agentic IDE built around pi |
| `vastsa/PI-Desktop` | `7b8c316` | Electron + Rust host, plugin platform around pi |
| `abcwyc/pi-agent-desktop` | `211bd1e` | Tauri shell + Next.js UI, fork of `agegr/pi-web` + bundled pi SDK |
| `bytesbay/pi-gpui` | `d4d37c8` | Native Rust/GPUI client over pi RPC |

Also inspected: `agegr/pi-web` (the upstream web UI that `pi-agent-desktop`
packages), the installed pi 1.6.0 standalone binary, and the current machine's
`~/.pi/agent` configuration (16 installed pi packages, custom providers).

Live prototypes run during research:

1. `pi --mode rpc` with a custom extension: session events, extension UI,
   permission blocking, and slash commands.
2. `pi --mode rpc --approve` in a project with a local extension: confirmed
   that project resources load only with trust.
3. Resumed a 243-message, 566 KB session over RPC: measured startup and payload.
4. Spawned `pi auth login` under a pty: confirmed an in-app login terminal is
   viable.
5. Built and ran the mygo `examples/hello` binary: measured binary size and
   physical footprint.

## 2. mygo: what it gives us

### Facts

- One Go binary; system webview (WKWebView / WebKitGTK / WebView2), no bundled
  browser engine, no cgo. Frontend assets are embedded by `mygo build`.
- Typed IPC: Go services bound with `mygo.Bind`, methods called from generated
  TypeScript, events batched per main-loop turn (`enqueue` / `flush`).
- Custom protocol handlers (`mygo.Protocol`) run as `http.Handler` on their own
  goroutines; the app frontend is served from `mygo://localhost` in builds.
- Native window options include `TitleBarStyle: TitleBarHiddenInset`,
  `TrafficLightPosition`, `Vibrancy`, `BackgroundColor`, `StateKey`.
- Desktop APIs: menus, dialogs, notifications, `Shell.OpenPath`,
  `Shell.TrashItem`, file watching, single-instance lock.
- `mygo build` produces a `.app` and `.dmg` on macOS; signing/notarization are
  optional steps.

### Measurements

| Measurement | Result |
|---|---|
| `examples/hello` release binary | 9.5 MB |
| `examples/hello` physical footprint, idle | 33 MB (app process) |
| Frontend load | embedded / local origin, no HTTP server |
| Idle CPU | 0% after settle (framework goal and observed) |

The framework's own architecture guide reports a ~7 MB hello binary, ~35 MB
physical footprint, and ~62 MB including WebKit helper processes. Our 9.5 MB
build is consistent with a current release and the small additions in `hello`.

### Why this matters

The shell can be small and fast without sacrificing a rich frontend. The heavy
part of this product is pi and the model providers, not the desktop shell.
mygo's webview choice gives us the web ecosystem (markdown, syntax highlighting,
virtualized transcripts, accessible dialogs) while keeping the native feel
(custom title bar, menus, notifications) and a tiny install.

### Constraints

- Pages are trusted only on the app's own origin. Never render user/third-party
  HTML in a trusted page; use an untrusted page or sanitized rendering.
- macOS apps launched from Finder do not inherit a login-shell `PATH`; finding
  `pi` and `node` must handle that explicitly.
- WKWebView runs its own processes; total footprint includes them.
- No built-in multi-window state beyond `StateKey`; we own app state.

## 3. pi: the engine

### Facts

- pi is a TypeScript coding agent with a unified multi-provider LLM API, agent
  loop, built-in tools (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`),
  sessions, compaction, retries, MCP, codemode, and extensions.
- Extensions are TypeScript modules loaded from `~/.pi/agent/extensions/`,
  project `.pi/extensions/`, packages, or `-e`. They can register tools and
  commands, intercept events, render TUI components, and ask the user through
  `ctx.ui`.
- Packages distribute extensions, skills, prompt templates, and themes. The
  installed configuration on this machine has 16 packages, including
  `pi-subagents`, `pi-lens`, `pi-powerline-footer`, `pi-rewind`,
  `pi-background-tasks`, `@juicesharp/rpiv-ask-user-question`, and
  `@juicesharp/rpiv-todo`.
- RPC mode (`pi --mode rpc`) is a long-lived JSONL protocol over stdin/stdout:
  commands in, responses + session events out, plus an extension-UI
  request/response subprotocol. It supports prompt, steer, follow-up, abort,
  model/thinking selection, compaction, retry, session switch/fork/clone, tree
  reads, commands, stats, and export.
- The standalone pi binary is 103 MB and embeds its runtime. `pi --version`
  works without Node.
- A resumed 243-message session took ~1.5 s to answer `get_messages`, and the
  response was 566 KB. Startup includes loading all installed extensions.
- Session files are append-only JSONL trees under
  `~/.pi/agent/sessions/--<encoded-cwd>--/`. Subagent runs live in nested
  directories and must not be listed as normal sessions.
- Project trust matters: in RPC mode, pi's trust context has `hasUI: false`, so
  the built-in trust prompt cannot appear. Without `--approve` or a saved
  `trust.json` decision, project-local settings/extensions/skills are not
  loaded. This was reproduced.
- `pi --mode rpc --approve` loads project extensions (reproduced).
- Extension UI in RPC mode supports `select`, `confirm`, `input`, `editor`,
  `notify`, `setStatus`, `setWidget`, `setTitle`, `set_editor_text`. It does not
  support `ctx.ui.custom()`, terminal input, custom editors/themes, or TUI
  component factories. `ask_user_question` has an explicit RPC fallback built on
  `select`/`input`, so it works. Some other extensions degrade or offer text
  fallbacks; `pi-subagents` has an opt-in component protocol for hosts like
  pi-web but we will not implement it in v1.
- pi has no built-in permission system. Extensions can implement one by
  intercepting `tool_call` and asking via `ctx.ui`. A prototype blocked
  `rm -rf` with a confirm dialog successfully.
- `pi auth login <provider>` requires an interactive terminal. A pty prototype
  showed the prompt and accepted input. Credentials are written by pi to
  `~/.pi/agent/auth.json`; the app must not write or print them.
- `pi list`, `pi install`, `pi remove`, `pi update`, `pi mcp`, and
  `pi auth` are CLI surfaces we can drive for management UI.

### Why RPC instead of the SDK

| | RPC | SDK |
|---|---|---|
| Extension compatibility | Real pi process, exact extension load order and runtime | Host must reproduce services and extension UI bridge |
| Crash isolation | pi dies, app survives | Extension crash can kill the host |
| Language | JSONL, usable from Go | TypeScript host required |
| Version coupling | Stable protocol within pi 1.x | Internal SDK types change more often |
| Custom extension UI | Limited to RPC subprotocol | Host can invent a bridge, but only for its own extensions |
| Session/auth | pi owns files and credentials | Same, but host wires more |

The RPC path is the only one that gives us "reuse existing extensions" without
reimplementing pi's loader, package manager, auth, and session machinery. It is
also the same path pi-gpui chose. The cost is the documented UI subset; we will
surface that honestly rather than pretend full TUI rendering.

## 4. Competitor analysis

### 4.1 pi-gpui

**Strengths**

- Closest architectural match: starts installed `pi --mode rpc` as a child,
  JSONL parser, one pi per open session, sessions read from pi's JSONL.
- Excellent performance discipline: 16 MB app, ~0.4 s window, ~75 MB idle,
  benchmarked against Electron clients.
- Thoughtful product rules in `docs/APP_PRINCIPLES.md`: pi owns agent/auth/data;
  app owns windows/sessions/UI; never rewrite pi's files; version range with
  feature detection.
- Handles extension dialogs inline; tree navigation is filled by a small
  bundled bridge extension; context/usage details via `setStatus`.
- Ships a plugin system (process-isolated) and live views inside tool calls.

**Weaknesses / opportunities**

- Native GPUI means a huge amount of bespoke UI code; extension status widgets
  and window titles were still unsupported at the inspected version.
- Markdown/code rendering and layout flexibility are harder to evolve than web.
- No first-class diff review/changes panel (it has a Changes panel, but the
  product surface is smaller).
- Only runs where GPUI/Vulkan works; no Windows.
- Uses installed pi only (no zero-setup path); session list includes subagent
  sessions unless filtered.

**Lesson for us:** copy the principles, not the architecture. RPC + installed pi
is right. Beat it on UI richness, extension UI fidelity, session/diff workflow,
and web-platform reach, while matching its startup and memory discipline.

### 4.2 pi-agent-desktop (pi-web fork + Tauri)

**Strengths**

- Complete daily-driver feature set: sessions by project, real-time thinking/
  tools/context/cost, branches and forks, models/auth/skills/plugins, worktrees,
  file previews (code, Markdown, images, audio, PDF, DOCX), scheduled tasks,
  dark mode, session naming, run-state restore.
- Bundles the Node server and pi SDK into the app, so it works without a
  separately installed pi.
- Reads existing `~/.pi/agent` data, so it is compatible with the CLI.

**Weaknesses / opportunities**

- Tauri + Next.js + bundled Node server + pi SDK is a large stack; the desktop
  shell only packages an upstream web app it does not own.
- The fork carries a permanent merge-maintenance burden (`docs/ownership-
  boundaries.md` measures ~1,379 structural divergent lines concentrated in a
  few upstream files; silent semantic merges are a named risk).
- No direct RPC process isolation: pi runs in-process in the server.
- Heavy install and startup compared with a Go shell.
- Extension custom UI is still a subset; it invents a component bridge for some
  extensions.

**Lesson for us:** the feature checklist is a good parity target. Do not fork a
web app or bundle a Node server. Own a small shell and talk RPC.

### 4.3 ThinkRail

**Strengths**

- The most complete agentic IDE: worktree workspaces, Monaco, terminals,
  multi-session, spec graph, subagents, background commands, plans, artifacts,
  MCP, skills import, command palette, reviews, PR/CI integration, i18n, themes.
- Deep UX thinking: chat/editor/panel focus model, inline interactive tool
  renderers, docked questions, artifacts, next-step suggestions.
- Ships reusable pi extensions (`ask-user-question`, `visualize`, `next-steps`)
  so the terminal gets the same tools.
- Strong specs and ADRs; explicit performance and recovery work.

**Weaknesses / opportunities**

- Enormous surface area and a heavy in-process server; long startup and high
  memory relative to a focused desktop client.
- In-process SDK integration requires reimplementing large parts of pi's loader,
  auth, model policy, and extension UI bridge; version drift is continuous.
- UI is an IDE, not a "desktop coding agent"; for users who want chat + changes,
  it is overwhelming.
- Localization and theme systems add maintenance weight.

**Lesson for us:** pick the high-leverage IDE features (sessions, diffs, files,
questions, plans) without becoming an IDE. Borrow UX patterns, not scope.

### 4.4 PI-Desktop

**Strengths**

- Ambitious plugin platform: process-isolated plugins, permissions, panels,
  tools, skills, MCP, themes, background services, live views.
- Deep work on permissions, plan approval, subagents, context compaction,
  transcript virtualization, delta streaming, provider management, recovery.
- Hundreds of ADRs document hard-won edge cases.

**Weaknesses / opportunities**

- Electron + Rust host + Node sidecar + plugin runtime is the heaviest possible
  stack; 401 MB on disk in pi-gpui's benchmark.
- 300+ ADRs and a sprawling plugin API are a maintenance and comprehension cost;
  the core product is hard to explain.
- Plugin isolation and capability sandboxing are still in progress.
- Feature density risks a settings maze; the default experience is not calm.

**Lesson for us:** use its ADRs as a bug/edge-case checklist, not as a template
for scope. Keep one process boundary (pi RPC), one UI, one settings file.

### 4.5 agegr/pi-web

**Strengths**

- Mature browser UI for pi with sessions, branches, worktrees, file previews,
  provider login, model tests, plugins, skills, i18n, terminal.
- Server owns pi SDK sessions; good abstractions for streaming and session state.
- Interactive demo and screenshots make the product legible.

**Weaknesses / opportunities**

- Browser server architecture; not a native desktop app. Needs Node and a port.
- No native menus, notifications, window chrome, or app lifecycle.
- In-process pi SDK; extension UI bridge is host-specific.

**Lesson for us:** it proves the feature set is expected. A desktop app can win
on launch speed, native integration, and a calmer, more focused UI.

## 5. Proposed architecture

```
┌─────────────────────────────────────────────────────────────┐
│ mygo app (Go, single binary)                                │
│  ├─ window: WKWebView, hidden inset title bar, vibrancy      │
│  ├─ frontend: React 19 + Vite, embedded assets               │
│  ├─ typed IPC: Go services ↔ generated TS client             │
│  ├─ agent manager: one `pi --mode rpc` per open session      │
│  ├─ session index: read-only JSONL scan + fast transcript    │
│  ├─ workspace/git/files/trust/settings                       │
│  └─ login pty, package/MCP CLI bridge, diagnostics           │
└───────────────┬─────────────────────────────────────────────┘
                │ JSONL over stdin/stdout
┌───────────────▼─────────────────────────────────────────────┐
│ installed pi (>=1.6 <2), real extensions/packages/skills     │
│  ├─ models, auth, sessions, compaction, retries, MCP         │
│  ├─ built-in tools                                           │
│  └─ bundled `pis-bridge` extension:                          │
│       tree navigation, usage bridge, project trust is app-   │
│       side, smart approvals, plan mode, session status       │
└─────────────────────────────────────────────────────────────┘
```

### Key choices

1. **RPC, not SDK.** Real pi process; extension reuse; crash isolation.
2. **One pi process per open session.** Switching chats does not stop work.
   Idle sessions stay alive while the app runs; a "Sleep" action stops one.
3. **App owns trust, not pi's hidden prompt.** RPC cannot show pi's trust UI.
   The app asks before spawning, passes `--approve` only for trusted projects.
   It reads pi's `trust.json` for existing decisions and never writes it.
4. **Fast transcript from JSONL, pi remains authoritative.** Read the active
   branch from the session file immediately; reconcile with pi events. Do not
   block first paint on `get_messages` (~1.5 s / 566 KB in the measured case).
5. **Delta-only streaming with a 16 ms coalescer.** Never send cumulative
   assistant snapshots per token. Flush before tool/message boundaries.
6. **A bundled bridge extension fills RPC gaps.** Tree navigation, plan mode,
   approvals, usage/status. It is CLI-loaded with `-e`, so it does not depend on
   project trust and does not enter the user's package list.
7. **No HTTP server in the desktop app.** Typed mygo IPC and custom schemes only.
   The page is the app's own origin; no third-party HTML in a trusted page.
8. **Pi owns data.** Never write session JSONL, auth, models, or settings. Use pi
   commands and the file formats only for read-only display. App state lives in
   its own directory.

### Why not native mygo UI

mygo's `ui` package is impressive and fast, but rebuilding a rich Markdown/
syntax-highlighted/diff/transcript UI there would be a multi-month product on
its own, and it would not reuse the web ecosystem. The webview is the right
tradeoff for this product; the shell stays small and native where it matters
(window chrome, menus, notifications, dialogs).

## 6. Product gaps and differentiation

What users of Claude Code / Codex expect, and where we can beat the current pi
clients:

| Capability | pi CLI | pi-gpui | pi-agent-desktop | ThinkRail | Our v1 |
|---|---|---|---|---|---|
| Real pi extensions | yes | yes | SDK subset | SDK + bridge | yes, RPC |
| Extension dialogs | TUI | yes | yes | yes | yes, inline dock + free text |
| Session tree/fork | TUI | yes (+bridge) | yes | yes | yes (+bridge) |
| Live tool cards | TUI | yes | yes | yes | yes, rich built-ins |
| Diff review | no | changes panel | yes | yes | yes, focused |
| Project trust | TUI | via flag | app | app | app dialog + flag |
| Smart approvals | extension | no | yes | yes | optional built-in |
| Plan mode | extension | no | yes | yes | built-in toggle |
| Todo panel | extension | no | yes | yes | renders `todo` tool |
| MCP | yes | basic | full | full | list + CLI, v1 |
| Subagents | extension | generic | full | full | generic + child links |
| Worktrees | no | no | yes | yes | deferred |
| Command palette | no | no | yes | yes | yes |
| Native feel | terminal | native | Electron | Electron | native shell + web UI |
| Startup | fast | 0.4 s | ~0.7 s | heavy | target <0.7 s |
| Install size | 103 MB | 16 MB + pi | ~400 MB | large | <30 MB + pi |

The differentiation is not "more panels". It is a **fast, calm, native-feeling
desktop client with real pi extension compatibility, excellent streaming and
tool rendering, and a safe default approval/trust model**.

## 7. Risk register

| Risk | Evidence | Mitigation |
|---|---|---|
| RPC UI subset breaks some extensions | `custom()` unsupported; pi-gpui says statuses/widgets unsupported | Support all RPC UI methods; detect and explain TUI-only components; test with the installed 16 extensions |
| Extension noise floods the UI | Prototype startup emitted ~20 status/widget requests before the first prompt; powerline emits ANSI strings | Coalesce, strip ANSI, status drawer, widgets opt-in, dedupe |
| Project trust silently disables extensions | Reproduced: without `--approve`, `.pi/extensions` not loaded, no prompt in RPC | App-side trust dialog + `--approve`; show trust state |
| Resume blocks on `get_messages` | 1.5 s, 566 KB for 243 msgs | Fast JSONL transcript; load pi in background |
| O(n²) streaming | PI-Desktop ADR 0242 | Delta-only, 16 ms coalescer, memoized transcript rows |
| Long sessions exhaust memory | PI-Desktop ADR 0130 | Virtualized/windowed transcript, bounded result payloads |
| Single-writer session conflict | pi doesn't lock sessions | App opens a session at most once; lease file; warn on foreign lease |
| Finder PATH misses pi | pi-gpui precedent | Login-shell PATH lookup; explicit path setting |
| Version drift | pi 1.x minors; SDK changes | RPC + min/tested version, feature detection, clear diagnostics |
| Double permission prompts | User already has `cc-safety-net` | Detect known guard extensions; make our guard optional/default off when one is present |
| Auth terminal leaks secrets | pty output may contain key prompt | Never log pty output; local only; clear buffer on close; no persistence |
| App crash loses runs | pi child dies with app | Graceful quit; on quit warn; sessions are durable; offer resume |
| Large tool results freeze UI | base64 images, long bash output | Payload cap per event; detail-on-demand; virtualization |

## 8. Facts vs inferences

Facts: repository contents, documented APIs, measured startup/payload/binary/
footprint, reproduced trust behavior, reproduced permission dialog, reproduced
pty login prompt.

Inferences: expected user preference for a calm UI, the value of a built-in
plan mode, the exact memory of the final app, and the speed of the final
frontend. These are validated during implementation with budgets and tests.

## 9. Open questions

The product decisions that change scope or architecture are in the grilling
round, not silently assumed here. See `01-decisions.md` for proposed answers and
`03-progress.md` for the current gate.
