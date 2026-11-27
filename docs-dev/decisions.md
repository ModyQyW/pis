# Decisions

[English](decisions.md) | [简体中文](decisions.zh.md)

Status: **accepted 2026-11-22** after the round-1 grilling answers (all A).
The Q6 extension-conflict constraint applies to ADR-008, ADR-009, and ADR-010.

Format is a lightweight ADR: context, decision, consequences, alternatives.

---

## ADR-001 — Talk to pi over RPC, not the SDK

**Context.** We need real extension/package/skill compatibility and process
isolation. The SDK is TypeScript-only and requires reimplementing pi's resource
loader, auth, and extension UI bridge. RPC is documented and stable within pi 1.x.

**Decision.** Spawn `pi --mode rpc` per open session. Speak strict JSONL over
stdin/stdout. Correlate commands by ID. Treat stderr as diagnostics only.

**Consequences.** Existing pi extensions load exactly as in the CLI. A pi crash
does not kill the app. RPC's UI subset is a hard limit; we surface it. We depend
on an installed compatible pi.

**Alternatives.** SDK in a bundled Node process (pi-agent-desktop, ThinkRail);
rejected for version coupling, process weight, and extension UI duplication.
Reimplementing pi (rejected outright).

---

## ADR-002 — mygo webview shell, not native UI

**Context.** The product needs Markdown, syntax highlighting, diffs, virtualized
transcripts, accessible dialogs, and rapid UI iteration. mygo can host a web
frontend in the system webview with a ~10 MB binary, or draw native UI in Go.

**Decision.** Use mygo's webview window with a Vite/React frontend. Use a hidden
inset title bar and native menus. Use mygo's native APIs for dialogs, menus,
notifications, shell integration, and window chrome.

**Consequences.** Small shell, no bundled browser, web ecosystem available.
Total footprint includes WKWebView helpers. We must sanitize all rendered
Markdown and never load third-party HTML into a trusted page.

**Alternatives.** mygo native UI (too much bespoke UI work; no web ecosystem);
Electron (heavy); Tauri (not the requested framework).

---

## ADR-003 — One pi process per open session, kept alive

**Context.** Users expect parallel chats and background work. pi sessions are
cheap to resume but expensive to cold-start (1.5 s with many extensions).

**Decision.** Spawn one pi process per open session. Keep it alive while the app
runs. Switching chats never stops a run. A "Sleep" action stops one; closing the
app stops all. Cap live sessions at 6 by default, with a clear warning.

**Consequences.** Memory grows with open sessions (pi is the heavy part). Background
completions and approvals work. We must handle process exit and resume carefully.

**Alternatives.** One active process (loses background work); one process per
workspace (pi has no multi-session runtime in one RPC process).

---

## ADR-004 — App-owned project trust before spawn

**Context.** In RPC mode pi's trust context has `hasUI: false`; project-local
extensions/settings do not load and no prompt appears. Reproduced.

**Decision.** The app reads pi's `trust.json` and detects trust-requiring
resources. If undecided and resources exist, show a native/web trust dialog
listing what will load. Persist the app's decision. Pass `--approve` only when
trusted; otherwise pass nothing. Never write pi's `trust.json`. Re-prompt if the
project's trust-requiring resources change.

**Consequences.** Trust is explicit and visible. A project trusted in the CLI is
honored; a project trusted in our app is not written back to pi's store. The app
must restart a session after a trust change.

---

## ADR-005 — pi owns data; app owns UI state

**Context.** pi session JSONL, auth, models, settings, and packages are shared
with the CLI. Writing them behind pi's back risks corruption and incompatibility.

**Decision.** Never write pi session JSONL, `auth.json`, `models.json`, or
`settings.json`. Use pi commands for mutation (prompt, fork, rename, compact,
install, auth). Read session JSONL only for a display cache. App state lives in
`PathUserData` (recent workspaces, trust decisions, UI preferences, permissions).

**Consequences.** CLI and app stay compatible. Some actions require a session
restart. Delete session via trash after closing the process.

**Alternatives.** Direct JSONL editing (fragile, breaks branch/compaction
invariants); direct auth writes (security and format risk).

---

## ADR-006 — Fast transcript from JSONL, pi as authority

**Context.** `get_messages` for a 243-message session was 566 KB and took ~1.5 s
including pi startup. Blocking first paint on it feels slow.

**Decision.** On open, read the session file's active branch in Go and send a
display transcript immediately. Start pi in parallel. Live events update the
display. `get_messages`/`get_state` reconcile model, usage, and any divergence.
The display cache is never used for model context.

**Consequences.** Sub-150 ms transcript paint for typical sessions. We must
implement branch/compaction-aware display parsing and tolerate partial data
while pi starts. Divergence is corrected by pi's authoritative messages.

**Alternatives.** Wait for `get_messages` (simple, slow); parse only on demand
(slow first scroll).

---

## ADR-007 — Delta-only streaming with a 16 ms coalescer

**Context.** Sending cumulative assistant snapshots per token is O(n²) in bytes
and CPU (PI-Desktop ADR 0242). Token rates can exceed display frame rates.

**Decision.** In Go, coalesce `message_update` text/thinking deltas per message
and content block, flush at most every 16 ms, and flush immediately before tool
events, message end, abort, and error. Send only deltas plus authoritative
`message_end`. The UI appends to the live message and replaces it at end.

**Consequences.** Linear wire cost, smooth rendering, order preserved. The
frontend must handle reset/replacement events (provider retries/edits).

**Alternatives.** Coalesce in the renderer (too late; serialization already
happened); send full snapshots (rejected).

---

## ADR-008 — Bundled bridge extension, namespaced and CLI-loaded

**Context.** RPC lacks tree navigation, a plan-mode switch, and a place to make
approval decisions. Loading our logic as a project extension would require trust
and pollute the user's package list.

**Decision.** Ship a small `pis-bridge` pi extension embedded in the app binary,
written to app data on version change, loaded with `-e` for every pi process.
It registers namespaced commands (`pis-navigate`, `pis-plan`), listens to
`tool_call` for approvals, and publishes usage/status via `setStatus`. It never
writes pi data. Project trust remains app-owned.

**Consequences.** Fills RPC gaps without installing anything globally. The
bridge must track pi's extension API within the supported version range and
degrade gracefully if a feature is missing.

**Conflict rules (Q6).** Commands are namespaced `pis-*`; the bridge never
registers a `todo`, `ask_user_question`, `plan`, or `subagents` tool/command.
It must not remove or rewrite user packages. If an existing plan command is
detected, the app surfaces it rather than claiming ownership.

**Alternatives.** Install a global package (visible/persistent, harder to
version with the app); fork pi (unmaintainable).

---

## ADR-009 — Plan mode as a first-class app mode

**Context.** Claude Code/Codex users expect a plan-first workflow. pi omits plan
mode by design; extensions exist but are not installed for everyone.

**Decision.** A composer toggle enters Plan mode. The bridge extension switches
the active tool set to read-only built-ins (plus read-only extension tools where
known), injects plan instructions through `before_agent_start`, and blocks
mutating tools. The model writes the plan in chat. "Approve plan" exits plan
mode and sends an execution instruction. Mode persists in a custom session entry
and is reflected in the UI.

**Consequences.** Safe exploration and explicit approval. Bash is still powerful;
in Plan mode mutating bash commands are denied/asked. Plan mode is not a security
boundary; approvals and the OS remain the boundary.

**Conflict rules (Q6).** Our command is `pis-plan`, not `plan`. If `get_commands`
shows an installed plan-mode command, the UI offers that instead of pretending
our toggle controls it. We never disable the other extension.

**Alternatives.** No plan mode (parity gap); a separate planner agent/model
(heavy, contrary to pi's one-session model).

---

## ADR-010 — Smart approvals, optional and extension-aware

**Context.** pi has no built-in permissions. Users may already run a guard
extension (this machine has `cc-safety-net`). Asking twice is bad UX; asking
never is unsafe.

**Decision.** Offer three policies: Smart (default), Ask all, Allow all.
Smart auto-allows read-only tools and edits/writes inside the workspace; asks
for destructive/out-of-workspace/privileged bash, sensitive paths, and unknown
risky tools. Requests stay pending until answered (no auto-deny). Grants can be
once or for the session. Detect known guard extensions and offer to disable our
guard for that setup. The policy is enforced by `pis-bridge` in pi, not by the
renderer.

**Consequences.** Useful safety without constant prompts. Heuristics are not a
sandbox; document that clearly. Users can opt out. We must not double-prompt
existing guard setups.

**Conflict rules (Q6).** Detect known guard packages/commands at session start.
When one is present, the app guard defaults to off for that workspace and the
UI says which guard is active. Enabling ours is explicit. Our bridge does not
block a call another guard already blocked, and it does not duplicate a prompt
for the same tool call.

**Alternatives.** Pi-native autonomy (no prompts); ask-for-everything (noisy);
OS sandbox only (out of scope for v1).

---

## ADR-011 — Frontend stack

**Context.** We need a polished, accessible, high-performance UI with a small
team-sized codebase.

**Decision.** React 19 + TypeScript + Vite. Tailwind CSS v4 with design tokens.
**Base UI** primitives, styled with generated shadcn-style components; AI
Elements message/trace/attachment/marker components adapted to Base UI. Zustand
for session/UI state. `@tanstack/react-virtual` for the transcript, with dynamic
row measurement and a pinned-end scroll model. **Streamdown** for
Markdown with its official code (Shiki), KaTeX math, CJK, and Mermaid plugins.
`diff` for patch parsing. Lucide icons.

**Consequences.** Fast iteration, accessible primitives, good ecosystem. The
Markdown renderer is a lazy chunk (1.75 MB, 580 KB gzip) with a 634 KB main
chunk (198 KB gzip). Production builds omit source maps. The transcript is
memoized per row and virtualized; streaming Markdown is deferred so token
updates do not force a full re-render.

**Alternatives.** Radix plus a second primitive layer (rejected: two design
systems); hand-rolled Markdown (rejected: table/math/diagram/code maintenance);
Svelte/Solid (smaller runtime, smaller ecosystem); native UI (rejected);
Electron renderer conventions (not applicable).

---

## ADR-012 — Local-first persistence, JSON not SQLite

**Context.** App state is small: recent workspaces, trust decisions, UI prefs,
permission policy, window layout. Session history belongs to pi.

**Decision.** Store app state in versioned JSON files under `PathUserData` with
atomic writes and a file lock. Cache session index metadata keyed by file
mtime/size. No database dependency in v1.

**Consequences.** Easy to inspect and back up; no migration framework needed.
Rewriting the whole file is fine at this size. A corrupt file falls back to
defaults and is reported, never silently overwritten.

**Alternatives.** SQLite (extra dependency for little gain); pi's settings
(mixing app and agent config).

---

## ADR-013 — Performance budgets are acceptance criteria

**Context.** "Performance excellent" is not testable as an adjective.

**Decision.** Budgets:

| Metric | Budget |
|---|---|
| Window visible (warm launch) | < 700 ms |
| First transcript paint, 1k-message session | < 150 ms |
| Streaming UI frame cost | < 8 ms typical, no full-transcript re-render |
| Idle app footprint excluding pi | < 120 MB physical |
| Idle CPU | ~0% |
| App bundle excluding pi | < 30 MB |
| Session switch (cached) | < 100 ms |

Measured on the delivery machine. Regressions are recorded in `testing.md`.

**Consequences.** Drives architecture (fast JSONL, delta coalescing,
virtualization). We measure before claiming.

**Alternatives.** "Best effort" (rejected; not verifiable).

---

## ADR-014 — macOS-first, cross-platform code

**Context.** The delivery machine is macOS arm64. mygo supports macOS, Windows,
Linux. Full QA on three platforms is out of scope for the first version.

**Decision.** Ship and verify macOS arm64. Keep all platform-specific code behind
small helpers (paths, login shell, open/reveal, trash). Keep Windows/Linux builds
compiling when practical, document them as untested. No macOS-only assumptions in
the frontend beyond modifier keys.

**Consequences.** A credible first version without pretending cross-platform QA.
Windows/Linux get a follow-up hardening pass.

---

## ADR-015 — English default, Chinese UI available

**Context.** The product is open source and aims beyond one user; the requester
writes Chinese. Claude Code/Codex are English-first.

**Decision.** Ship English as the default and a Chinese locale (`zh`) selected
in Settings. Keep the main shell/dialog strings in `lib/i18n.ts`, keyed by the
English source text, with a `t()` lookup and `{name}` placeholders. The root
subscribes to locale changes so non-React memoization does not freeze copy.
Native shell/updater language follows the same setting via
`mygo.App.SetLocale`. App name "PiS" (repo `pis`).

**Consequences.** Chinese users get a translated shell, settings, onboarding,
MCP/worktree managers, and extension dialogs. Tool output, server names, model
names, and code remain as the tool produced them. Native macOS menu labels stay
English. The dictionary is additive; new English copy falls back safely.

**Alternatives.** Chinese-first (narrower); English-only hardcoded strings (makes
later i18n expensive); a full message-catalog build step (overkill for one
additional locale).


---

## ADR-016 — One visual system from AI Elements and shadcn, not two

**Context.** The first UI was a set of bespoke React components. It looked
coherent but reimplemented message bubbles, attachments, collapsibles, menus,
dialogs, and toasts, and it had no Markdown table/math/Mermaid support. Adding
shadcn's registry components alongside the handwritten layer would create two
design systems and duplicate primitives.

**Decision.** Adopt the shadcn generated component surface on top of Base UI,
and use AI Elements composition for messages, bubbles, traces, attachments, and
markers. Keep one token vocabulary: app foreground (`fg`), secondary text
(`subtle`), tertiary text (`faint`); shadcn's `muted` is a surface, never text.
Use Streamdown for prose with its official code (Shiki), math, CJK, and Mermaid
plugins. Keep custom surfaces only where they carry product-specific behavior
(tool cards, diff view, approval dock, changes panel).

**Consequences.** Consistent accessibility and focus behavior; fewer bespoke
components. The generated registry files are app code and are reviewed like it.
The Markdown chunk and its official plugin dependencies are lazy; Shiki grammar
chunks load on demand. `components.json` is not used because the components are
copied, not generated at build time.

**Alternatives.** Keep the bespoke layer (more code, weaker accessibility);
Radix (a second primitive runtime next to Base UI); replace every component
including tool cards (would erase product-specific density and behavior).

---

## ADR-017 — TanStack Virtual for the transcript; exact latest dependencies

**Context.** The transcript uses dynamically sized rows: Markdown tables, code
blocks, tool output, images, and streaming text change height after mount.
`react-virtuoso` handled this, but the project standardizes on TanStack for
virtualization and the dependency needed to be removed. The repository pins
direct dependencies exactly and had no git history.

**Decision.** Use `@tanstack/react-virtual` with `useVirtualizer`:
`measureElement` for dynamic row heights, `getItemKey` tied to transcript IDs,
`overscan: 8`, and `paddingStart`/`paddingEnd` for the old header/footer
spacing. Keep the reader pinned to the end while they have not scrolled away;
`ResizeObserver` catches late Markdown/Shiki/image growth. Appended rows use
`followOnAppend: "smooth"`; content growth in the last row scrolls after layout.
Scrolling up past 100 px releases the pin and shows the jump-to-latest button.

Direct dependencies are pinned to exact versions in `package.json`; the lockfile
is committed. Updating a direct dependency updates the lockfile and requires a
typecheck, tests, production build, and the relevant browser surface check.
KaTeX is a direct dependency only for its CSS, while `@streamdown/math` resolves
its own KaTeX; the two-version split is accepted because both render correctly,
and math is part of the browser smoke.

**Consequences.** The transcript renders only the visible window plus overscan
(300-row harness: 16 mounted rows, bottom distance 0), so long sessions no longer
mount every row. The app keeps its existing streaming behavior without
Virtuoso. The package no longer ships `react-virtuoso`.

**Alternatives.** Keep Virtuoso (rejected: requested removal and two
virtualization stacks); hand-roll windowing (rejected: dynamic measurement and
scroll anchoring are hard to make reliable); fixed-height rows (breaks Markdown,
images, and tool output).

---

## ADR-018 — Official Streamdown plugins for code and Mermaid

**Context.** The Markdown surface needs syntax highlighting and Mermaid
diagrams. PiS had wrapped Pele for Mermaid and considered a bespoke Shiki
highlighter to cut language chunks. Streamdown already publishes supported
`@streamdown/code` and `@streamdown/mermaid` plugins with lazy grammar loading,
controls, error handling, and a tested integration surface. Maintaining custom
renderers duplicates that work and drifts on styling and streaming behavior.

**Decision.** Use `@streamdown/code` and `@streamdown/mermaid` directly in the
Streamdown `plugins` map. Do not import Pele or Shiki into application code and
do not maintain a custom code-highlighter. Keep only app-level token styling for
the plugin containers. Use `createMathPlugin({ singleDollarTextMath: true })`
and `@streamdown/cjk` as before.

**Consequences.** The Markdown dependency is lazy; code grammars are lazy
chunks fetched only when a language appears, and Mermaid loads its renderer only
when a diagram appears. The package includes the official plugin assets instead
of a hand-trimmed grammar set; this is the supported optimization boundary. Do
not "optimize" by forking the plugin or deleting grammar chunks, because that
breaks arbitrary code fences. Removing Pele also removes its theme bridge and
custom error fallback.

**Alternatives.** Keep Pele plus `@streamdown/code` (two diagram/highlighting
stacks); custom Shiki highlighter (smaller grammar set but unsupported and more
code); no highlighting (worse readability).

---

## ADR-019 — Remote Markdown images load in the transcript

**Context.** Assistant output and imported sessions can contain Markdown images.
Streamdown hardens raw HTML, `javascript:` links, `data:` images, and `file:`
images, but it loads `http(s)` and protocol-relative image sources directly.
Blocking them would break screenshots, diagrams, and provider-hosted images that
users expect to see; proxying them would add a network service to a desktop app.

**Decision.** Keep remote image loading. Do not add an image proxy or a
per-image prompt. Links still require a click because the app intercepts anchor
navigation, but images are not links. `data:` and `file:` images stay blocked by
the renderer; tool and attachment images are separate, trusted `data:` elements.

**Consequences.** A model reply or a transcript from another machine can make
the webview request a remote URL, which reveals the user's IP and can probe
services reachable from the machine (for example `http://127.0.0.1:...`). This
is an accepted usability tradeoff, not a sandbox guarantee. Users who need a
strict network boundary must use the OS, a container, or a VM. Record new image
behaviors here before changing the renderer.

**Alternatives.** Block remote images (breaks common screenshots and provider
URLs); proxy every image (new service and attack surface); render images as
links (extra click for every diagram).

---

## ADR-020 — Write pi's configuration from the GUI

**Context.** PiS inherited models, providers, skills, extensions, packages, and
MCP servers by running pi, but the user could only see the parts already shown
in a session. The only way to change defaults, add a compatible provider, or
review discovered resources was to edit pi's JSON files or run pi's terminal
`config` UI. The previous boundary said PiS never writes pi's model
configuration. Users asked for the same configuration workflow in the app.

**Decision.** Let PiS read pi's user configuration and write `settings.json`
and `models.json` only after an explicit save in the Pi configuration dialog.
`mcp.json` keeps its existing flow. Writes are atomic, keep fields PiS does not
edit, and run only on user actions. Defaults, custom providers and models,
skill and extension paths, and package sources are editable. Package sources
are declarations; pi installs them at session start. Stored provider keys are
written to `models.json` and never returned to the page; `Inspect` reports only
whether a key exists. PiS still never writes `trust.json`, `auth.json`, or
session content.

A fingerprint of the user-level configuration drives a confirmation banner.
Saving a change records the new fingerprint, so the banner does not repeat
until an external edit changes the configuration.

**Consequences.** The write boundary is wider than before and must stay
explicit: every new write needs a user action, a copy-safe merge, and a test.
Project-local declarations are listed but not read, edited, or walked from
PiS before project trust; they still load only after trust. A custom provider key passes through the
renderer once when the user types it. That is unavoidable for a GUI form; the
key is never stored in PiS settings, returned by `Inspect`, or logged.

**Alternatives.** Stay read-only and deep-link to the files (rejected: no GUI
configuration); embed pi's terminal `config` UI (rejected: interactive TUI
inside a webview adds a terminal emulator for one screen); let users edit JSON
in the app (rejected: validation and scoped writes are harder to get right).
