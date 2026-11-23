# Pitfalls, mistakes, and corrections

This file exists so we do not rediscover the same traps. Each entry says what
happened (or was proven by inspection), the consequence, and the rule that
prevents it.

## RPC and pi

### P-001 — RPC project trust has no UI
**Evidence.** `createProjectTrustContext` in pi's CLI passes
`hasUI: isInitialRuntime && trustPromptMode === "interactive"`. A bridge
extension's `project_trust` handler saw `hasUI: false`; no dialog appeared and
project extensions stayed unloaded.
**Rule.** Detect trust in the app, ask there, pass `--approve` only after
consent. Do not rely on a `project_trust` extension hook in RPC.

### P-002 — `--approve` is required for project-local resources
**Evidence.** `get_commands` omitted a local `.pi/extensions/demo.ts` extension
without `--approve`, and included it with `--approve`.
**Rule.** Trust is a session-start flag. Changing trust requires restarting the
session process.

### P-003 — `ctx.ui.custom()` is unavailable in RPC
**Evidence.** pi's RPC extension UI docs: `custom()` returns `undefined`;
terminal input, custom editors, themes, and component factories are no-ops.
Some extensions fall back to text/select; `ask_user_question` has an RPC
fallback; `pi-subagents` has an opt-in host component protocol we do not
implement.
**Rule.** Implement every RPC UI primitive we can; detect TUI-only behavior and
explain it. Never pretend custom components render.

### P-004 — Extension status/widget traffic is noisy
**Evidence.** Startup with the installed 16 packages emitted ~20 UI requests
before the first prompt (powerline widgets, LSP status, subagent status, goal,
loop). Some strings contain ANSI escapes and TUI box drawing.
**Rule.** Strip ANSI, dedupe by key, cap visible chips, put full statuses in a
drawer, and make raw TUI widgets opt-in (default off). Never render every
`setWidget` inline.

### P-005 — JSONL framing is not `readline`
**Evidence.** pi docs: split only on LF; U+2028/U+2029 are valid inside JSON
strings and Node's `readline` splits on them.
**Rule.** Read bytes until `\n`, strip optional `\r`, parse. When writing
commands, escape U+2028/U+2029 if the writer is line-based (we write JSON lines;
Go's encoder escapes them by default, but test).

### P-006 — stdout backpressure stalls pi
**Evidence.** pi docs: a client that stops reading can stall the process.
**Rule.** Dedicated reader goroutine, bounded queues, coalescing for deltas, no
blocking the mygo main thread.

### P-007 — Shutdown is not `kill`
**Evidence.** pi docs: closing stdin starts an orderly shutdown; SIGTERM/SIGHUP
also; a second signal exits at once. Extensions may need time.
**Rule.** Close stdin, wait ~3 s, then kill. Surface an exit event with stderr
tail. Never silently kill a running turn without user intent.

### P-008 — One session, one writer
**Evidence.** pi does not prevent two processes opening the same session file.
pi-gpui uses lease files; terminal pi does not.
**Rule.** Open a session at most once in the app; write a lease next to the
session file (or app state) and refuse/warn if a foreign lease exists. Never
silently run two writers.

### P-009 — Resuming blocks on `get_messages`
**Evidence.** 243 messages / 566 KB / ~1.5 s including startup.
**Rule.** Paint from JSONL first, start pi in parallel, reconcile later. Do not
block the window or composer on pi startup; queue prompts until ready.

### P-010 — Subagent sessions pollute the session list
**Evidence.** `~/.pi/agent/sessions/--cwd--/<session>/<run>/<id>/run-0/session.jsonl`
contains child sessions. A naive recursive scan lists them as chats.
**Rule.** Only direct children of the workspace session directory are main
sessions; mark nested files as subagent runs and hide them from the main list.

### P-011 — `get_messages` includes roles the UI must map
**Evidence.** Returned roles: `system`, `user`, `assistant`, `toolResult`,
`custom`; system messages contain prompt sections/tools.
**Rule.** Never render system messages as chat. Pair tool calls/results by
`toolCallId`; handle custom/display messages explicitly.

### P-012 — Model may be unavailable on resume
**Evidence.** ThinkRail spec: a saved session model can be absent from the
current provider catalog; silent fallback bills a different model.
**Rule.** Show the saved/selected model; if pi reports it unavailable, block
sending and ask the user to pick a model. Never silently run a different one.

### P-013 — Auth needs a TTY
**Evidence.** `pi auth login` errors without an interactive terminal; pty
prototype works.
**Rule.** Use a pty for login, stream output through typed IPC, never log it,
and never persist credentials ourselves.

### P-014 — Login output may contain secrets
**Rule.** The pty buffer lives in memory only; clear on close; do not write it
to logs, diagnostics, or crash reports. Warn that the terminal is a credential
surface.

### P-015 — Extension API drift
**Evidence.** pi 1.x adds/changes extension fields; the bridge must work on the
supported range.
**Rule.** Pin a tested minor range, feature-detect optional APIs, catch bridge
errors, and surface `extension_error` instead of failing the session.

## Frontend and performance

### P-016 — O(n²) streaming
**Evidence.** PI-Desktop ADR 0242: sending cumulative snapshots per token was
the root cause of long-turn slowdowns.
**Rule.** Delta-only wire format; 16 ms coalescer; flush before boundaries;
replace the message at `message_end`.

### P-017 — Re-rendering the whole transcript per token
**Evidence.** PI-Desktop ADR 0130: mounted rows retained React trees, Markdown
ASTs, and Shiki tokens; per-frame memo walked every row.
**Rule.** Virtualize/window the transcript, memoize rows by stable IDs, keep the
live tail in its own component, and avoid parsing Markdown for unchanged blocks.

### P-018 — Markdown/HTML injection
**Rule.** Streamdown hardens/sanitizes agent-provided HTML before rendering it.
Do not add custom rehype plugins that bypass that pipeline. Never navigate the
webview to model-provided links; only open `http(s)`/`mailto` links through the
OS on an explicit click, and never treat `data:` URLs as trusted.

### P-019 — Huge tool results
**Evidence.** Tool results can contain base64 images and thousands of lines.
**Rule.** Cap bytes per event to the renderer; stream/expand on demand; keep full
output in pi's file or fetch by path. Show truncation honestly.

### P-020 — Scroll fights the user
**Rule.** Follow the tail only when the user is at the bottom; preserve the
anchor when prepending history; never force-scroll while reading.

### P-021 — IME and send shortcuts
**Rule.** Do not send on Enter while an IME composition is active. Test Chinese/
Japanese input. Shift+Enter newline; Cmd+Enter alternate queue mode.

## Desktop shell

### P-022 — Finder PATH
**Evidence.** pi-gpui's principles and docs: apps launched from Finder do not
inherit nvm/fnm/Bun PATH.
**Rule.** Resolve pi via explicit setting, inherited PATH, common locations, then
the user's login shell (`$SHELL -lic 'printf ...'`) with a timeout. Cache it.

### P-023 — Window flashes white
**Rule.** Set `BackgroundColor` to the page background and show on
`OnReadyToShow` for a polished first paint.

### P-024 — Traffic lights overlap custom chrome
**Rule.** Use `TitleBarHiddenInset`, respect `--mygo-titlebar-*` CSS variables,
mark drag regions, and keep interactive controls `no-drag`. Test macOS light/
dark and full screen.

### P-025 — Quit while runs are active
**Rule.** Warn with the number of running sessions; give Cancel/Quit choices;
close stdin for orderly pi shutdown; never leave orphaned children silently.

### P-026 — Trusted page + untrusted content
**Rule.** The app's page is trusted and may call Go. Do not render third-party
HTML in it. Use sanitized Markdown or an untrusted webview/custom scheme for
user HTML previews.

### P-027 — Logs leak prompts/secrets
**Rule.** Log operational metadata only. Never log message content, pty output,
tokens, `.env` values, or auth headers. Diagnostics copy is redacted.

## Process and documentation

### P-028 — Silent semantic merges
**Evidence.** pi-agent-desktop's ownership doc: structural drift can merge
cleanly and be wrong.
**Rule.** We do not fork an upstream app. For the bridge and pi types, keep a
small compatibility layer and tests instead of copying large code.

### P-029 — Scope creep into an IDE
**Evidence.** ThinkRail/PI-Desktop feature lists; hundreds of ADRs.
**Rule.** V1 is a desktop coding agent, not an IDE. Deferred list is explicit.
Every panel must earn its place with a daily workflow.

### P-030 — Assuming instead of measuring
**Rule.** Performance, memory, startup, and trust behavior are measured and
recorded in `03-progress.md`. Inferences are labeled as such in docs and chat.

### P-031 — Do not duplicate installed extension tools (Q6)
**Context.** The user's install includes `todo`, `ask_user_question`, `subagents`,
skills, and guard/status extensions. Registering our own versions would shadow
or double-prompt.
**Rule.** Our bridge only registers `pis-*` commands and session status. It
never registers `todo`, `ask_user_question`, `plan`, or `subagents`. The UI
renders installed tool results and asks the installed ask extension through its
RPC fallback.

### P-032 — Do not double-prompt guard packages
**Context.** `cc-safety-net` and similar packages may already intercept tool
calls. Two guards produce two approvals and confuse the user.
**Rule.** Detect known guard packages/commands from `get_commands` and package
list; default our guard off when one is present; state which guard is active.

### P-033 — mygo dev and a separate Vite server fight for the port
**Context.** Running `bun run dev:web` for browser QA and then `mygo dev` makes
mygo's dev server fail with `Port 5173 is already in use`, though the app still
loads the existing server.
**Rule.** Stop the standalone Vite server before `mygo dev`, or set a different
`devUrl`/port for the run. Record which server the app is actually loading.

### P-034 — Fire-and-forget extension UI is not a blocker
**Symptom.** The first real session showed "An extension is waiting for input"
because every `extension_ui_request` was treated as a dialog.
**Cause.** Startup packages emit `setStatus`, `setWidget`, `notify`, `setTitle`,
and `set_editor_text`; only `select`/`confirm`/`input`/`editor` block.
**Rule.** Split fire-and-forget from dialogs; never surface a fire-and-forget
request as an error. Store statuses/widgets and queue only real dialogs.

### P-035 — Usage objects vary; guard every read
**Symptom.** A synthetic session fixture without `usage.cost` triggered a
`totalTokens` error in a user extension and a frontend render risk.
**Rule.** Normalize usage at the boundary (`normalizeUsage`) and guard every
display/stats read. A usage-less assistant message can exist in old or crafted
sessions even if pi normally writes usage.

### P-036 — HMR reload loses the active session (dev only)
**Symptom.** Editing frontend code reloads the webview; the active session
returns to the home state because the store is in memory.
**Rule.** Do not treat this as production behavior. For QA, relaunch with the
dev deep link (`PIS_OPEN_SESSION` / `?session=`). A production reload should
eventually restore the last session from app state.

### P-037 — `--session` resume with crafted history can break extensions
**Evidence.** A hand-written seed assistant message without `usage` made an
installed extension throw on the first prompt; the same prompt in pi's CLI with
`--no-session` worked.
**Rule.** QA fixtures must look like pi's own output (include usage and model
fields). Never conclude the app is broken from a malformed fixture.

### P-038 — Plan mode must keep read-only shell access
**Symptom.** The first plan-mode draft removed `bash` entirely, so the model
could not inspect the project beyond file tools.
**Rule.** Keep `bash`/`powershell` active in plan mode and block mutating
commands in `tool_call`; do not equate "read-only" with "no shell".

### P-039 — Fast transcript migration race
**Symptom.** A resumed session painted the fast transcript, then the session
key changed from the temp path key to pi's app id and the entries disappeared.
**Rule.** `openSummary` awaits both the transcript read and pi start before
migrating, and uses whichever entries are present; it also buffers events for
an unknown app id.

### P-040 — Status and dialog UI are different protocols
**Symptom.** Startup packages looked like blocking dialogs because every
`extension_ui_request` was surfaced as an error.
**Rule.** Fire-and-forget (`notify`, `setStatus`, `setWidget`, `setTitle`,
`set_editor_text`) updates state; only `select`/`confirm`/`input`/`editor`
queue a blocking dialog.

### P-041 — Usage objects are not guaranteed
**Symptom.** A synthetic session without `usage` made an installed extension
throw on `totalTokens`; a frontend guard prevents the app from adding its own
failure.
**Rule.** Normalize usage at ingestion; render with optional cost/tokens.

### P-042 — Bridge source must be versioned
**Symptom.** Editing `bridge.ts` without bumping `bridge.Version` leaves pi
loading the old file from app data.
**Rule.** Bump `internal/bridge/bridge.go` `Version` whenever the source
changes; `Ensure` writes a new file and removes older `pis-bridge-*.ts`.

### P-043 — Approval text needs human risk labels
**Symptom.** The first approval dialog showed a raw regular expression, which
does not help a user decide.
**Rule.** Map detection rules to labels ("recursive delete", "package install",
"outside the workspace") and include the command/path.

### P-044 — Trust decisions are app-owned but pi-compatible
**Symptom.** RPC has no trust UI; without a flag project resources silently do
not load.
**Rule.** Read pi's `trust.json`, keep PiS's decision in app settings, and
pass `--approve` only after consent. Never write pi's trust file.

### P-045 — Q6 extension conflicts
**Symptom.** Detected `cc-safety-net` would double-prompt with the built-in
approval guard; a generic `todo`/`ask` registration would shadow user tools.
**Rule.** Detect known guards and default our guard off unless forced; bridge
commands are `pis-*`; never register `todo`, `ask_user_question`, `plan`, or
`subagents`; surface an installed plan command instead of claiming it.

## UI system, Markdown, and packaging

### P-046 — Unlayered button resets beat Tailwind utilities
**Symptom.** The disabled Send button showed a dark arrow on a gray circle, and
`text-subtle` on menu and toolbar buttons did not apply.
**Cause.** `button, input, textarea { color: inherit }` was unlayered. Tailwind
utilities live in `@layer utilities`; unlayered CSS wins regardless of
specificity.
**Rule.** Put element resets in `@layer base`. Never place global element
selectors outside a cascade layer when Tailwind utilities must override them.

### P-047 — Source maps inflated the embedded app
**Symptom.** The release `.app` grew from 14.4 MB to 43.8 MB after the Markdown
renderer landed; `frontend/dist/assets` contained 687 files, 21 MB of them
`.map` files.
**Rule.** Emit production source maps only when a separate debug artifact is
needed. Vite production builds ship `sourcemap: false`; this restores the app to
22.7 MB.

### P-048 — Do not advertise shortcuts that are not wired
**Symptom.** The palette showed `⌘⇧T`, `⌘⇧C`, and `⌘⇧M`, but only the palette
displayed them; the keys did nothing. The composer said "Esc stops", but no
global Escape handler existed.
**Rule.** Every displayed shortcut must be implemented and tested in the
window-level key handler. Escape must be gated: skip when a Base UI dialog
(`[data-slot="dialog-popup"]`), menu, or pending extension dialog is open; check
`defaultPrevented` so a composer suggestion menu can consume it.

### P-049 — External links navigate the webview
**Symptom.** Clicking a Markdown link would replace the app page with the target
site.
**Rule.** Intercept `http:`, `https:`, and `mailto:` anchors at the document
level, prevent default, and call the shell's `OpenExternal`. Skip events already
handled by a component (for example the provider docs link).

### P-050 — Streamdown math needs explicit single-dollar opt-in
**Symptom.** `$O(1)$` rendered literally even though the math plugin and KaTeX
CSS were present.
**Cause.** `@streamdown/math` defaults `singleDollarTextMath` to false.
**Rule.** Build the plugin with `createMathPlugin({ singleDollarTextMath: true,
errorColor: "var(--danger)" })`. Keep KaTeX CSS imported only once. Tables,
fenced code, and `$$` blocks work with the default plugin.

### P-051 — A blank live session hid the starter cards
**Symptom.** Clicking New chat after a session existed showed a large empty
transcript with only "New chat", while the initial home showed the three
starter actions.
**Rule.** Render `EmptyState` for any active session with no parsed items and no
error/loading run, not only when there is no active session.

### P-052 — Settings showed the placeholder instead of the detected pi
**Symptom.** The pi executable field was empty when `settings.piPath` was unset,
even though bootstrap had `pi.path`; users saw a placeholder path and could not
tell what was in use.
**Rule.** Initialize the editable field from `settings.piPath ?? pi.path`, and
keep "Auto-detect pi" as the placeholder only when neither is present.

### P-053 — shadcn `muted` is a surface, not text
**Symptom.** User bubbles and inline code turned dark gray because the app's
text token `--muted` was also shadcn's `--muted` background token.
**Rule.** App secondary text is `--subtle` / `text-subtle`; shadcn's `--muted`
maps to `--surface-2`, and `--muted-foreground` maps to `--subtle`. Do not
reuse a Tailwind color key for two meanings.

### P-054 — Virtualizing replaces scroll ownership, not just the list component
**Symptom.** Replacing Virtuoso with `useVirtualizer` initially mounted all 300
rows because the test harness let the scroll container grow to its content
height. After constraining it, scroll-to-latest and streaming growth needed to
be reimplemented; Virtuoso's `followOutput` and `atBottomStateChange` do not
exist in TanStack Virtual.
**Rule.** A virtualized transcript needs one owner for: constrained scroll
element, bottom threshold, pinned-end state, append behavior, late row growth,
and jump-to-latest. Test all five with a throwaway browser harness before
committing. Keep the scroll element bounded with a flex parent and `min-h-0`;
a webview test that shows all rows is a layout failure, not a virtualization
success.

### P-055 — A direct major update can split a transitive dependency
**Symptom.** `katex` updated from 0.16 to 0.19 as a direct CSS dependency, while
`@streamdown/math` continued to resolve its own KaTeX 0.16. The lockfile now has
two versions, so a CSS/markup mismatch is possible.
**Rule.** When updating a direct dependency that also exists transitively,
check `bun pm ls <pkg>`, exercise the consuming UI (math, highlighting, icons),
and record the split. Do not silently assume the highest version is the one the
renderer uses. Prefer a direct version that matches the consumer when the
duplicate has no benefit.

### P-056 — macOS symlinked workspace paths create duplicate projects
**Symptom.** Opening `/tmp/pis-p0` added one project, then opening its
real pi session (which records `/private/tmp/pis-p0`) added a second project
with the same name.
**Rule.** Canonicalize workspace paths before comparison and persistence:
`filepath.Abs`, then `filepath.EvalSymlinks`, then `os.Stat`. Deduplicate
existing recents by canonical path on bootstrap and when adding/removing a
project. Keep display names from the canonical basename.

### P-057 — `git worktree list` returns canonical paths
**Symptom.** A worktree created under `/var/...` appeared in
`git worktree list` as `/private/var/...`, so the integration test compared
different strings and failed to find it.
**Rule.** Canonicalize worktree paths from porcelain output with
`filepath.EvalSymlinks` before returning them. Keep the user-entered path for
creation; compare and remove by the canonical form.

### P-058 — A project MCP override may carry only `enabled`
**Symptom.** A valid project `mcp.json` entry such as
`{"docs": {"enabled": false}}` has no command or URL. Treating it as a new
server would lose the user-level transport fields.
**Rule.** Merge project entries over user entries by name, and preserve the
user entry's command/args/URL/type when the project entry omits them. Only
replace transport fields the project explicitly sets; `enabled`, `exposure`,
and `description` may change independently.

### P-059 — Translation must run at render, not in a memo without locale
**Symptom.** Calling `t()` while building a `useMemo` value (for example a
palette group) stored English copy; switching language re-rendered the root but
the memo did not recompute, so part of the UI stayed English. Calling `t()` at
module scope has the same problem for starter labels.
**Rule.** Keep source strings as stable data and call `t()` during render, or
include the locale in the memo dependency. The root subscribes to locale changes
so plain render-time lookups refresh. Keep duplicate dictionary keys out: TS1117
catches them, but remove stale ranges rather than renaming one copy.

### P-060 — GitHub Actions major updates need consumer checks
**Symptom.** The action versions were several majors behind. `upload-artifact`
v7 and `download-artifact` v8 are ESM-based, and v8 makes a digest mismatch a
hard error instead of a warning. `action-gh-release` v3 runs on Node 24.
**Rule.** Pin `checkout@v7` and `setup-go@v7`, keep `upload-artifact@v7` and
`download-artifact@v8` on artifacts produced in the same run so hashes match,
and keep `action-gh-release@v3`'s `draft: true` on re-runs. Build Windows on
Ubuntu with NSIS and macOS on a macOS runner; a Linux runner cannot ad-hoc sign
or create a DMG.

### P-061 — PTY exit can race the final output read
**Symptom.** The pty login test passed locally but failed on Ubuntu CI with
`missing echo: "Login prompt\r\nhello\r\n"`; the process had exited 0 but the
reader had not delivered the final `got:hello`.
**Rule.** Keep a `readDone` channel. After `cmd.Wait`, wait for the reader to
drain (bounded, in case a child holds the pty) before closing `ptmx` and
emitting the exit event. A login window must not disappear before its last
line is visible.

### P-062 — A product rename changes the app data directory
**Symptom.** The PiS build opens with default preferences and no trust
decisions because mygo derives the user data path from the display name; the
old `Pi Mygo` directory is still on disk.
**Rule.** Treat data migration as a separate, explicit decision. The rebrand
leaves the old directory untouched instead of deleting or half-merging it; a
future migration can copy only settings, trust, and window state. Do not point
two app identities at the same directory.
