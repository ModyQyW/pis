# Implementation plan

Status: **approved 2026-11-22; refreshed 2026-11-23**. V1 implementation through Phase 9 is complete on macOS arm64; Phase 10 (delivery and user validation) is in progress; 0.0.3 is prepared. The wider-release roadmap is in §8.
Read `00-research.md`, `01-decisions.md`, and `03-progress.md` before every
phase. Update `03-progress.md` when a phase starts and ends.

## 1. Goal

Deliver a macOS desktop coding agent, `PiS`, built on mygo with pi as the
engine. It must feel like a polished native app, not a web page in a box:

- Instant, calm shell; fast transcript; smooth streaming.
- Real pi sessions, models, auth, skills, prompt templates, packages, MCP, and
  extensions.
- A focused workflow: workspace → chat → tool activity → review changes.
- Safe by default: explicit project trust, smart approvals, no hidden writes.
- Clean, documented code with tests and reproducible builds.

## 2. Scope

### V1 core (committed)

1. **Shell**
   - mygo window with hidden inset title bar, native menus, keyboard shortcuts.
   - Light/dark/system theme with design tokens; reduced-motion support.
   - First-run onboarding: find pi, version check, connect provider, open project.
   - Error states: missing pi, unsupported version, no models, process crash.
2. **Workspaces**
   - Add/open/recent/remove; folder picker; reveal in Finder.
   - Project trust detection and dialog; trust badge; restart on change.
   - Git branch/status in the sidebar.
3. **Sessions**
   - List recent sessions by workspace; resume; new chat; rename; delete to Trash.
   - Open sessions with live state; multiple concurrent sessions; sleep/close.
   - Session tree view, fork from a message, clone, branch navigation.
   - Auto-title from the first prompt; manual rename.
   - Export HTML (pi RPC), copy session path.
4. **Chat**
   - Streaming Markdown, thinking blocks, images, errors, retries.
   - Tool cards for `bash`, `read`, `edit`, `write`, `grep`, `find`, `ls`,
     `todo`, `ask_user_question`, and a generic fallback for extension tools.
   - Bash streaming output; expand/collapse; copy; open referenced files.
   - Edit/write diffs; read previews; image results.
   - Compaction divider with summary and token counts.
   - Usage: model, thinking level, context %, tokens, cost, duration.
   - Queue/steer/follow-up behavior while a run is active; clear queue.
   - Stop/abort; abort retry; errors with diagnostics.
5. **Composer**
   - Multiline editor, IME-safe, auto-grow, send/newline shortcuts.
   - `@file` fuzzy search; slash commands (extensions, prompts, skills).
   - Image paste/drop; text file attachments; chips; remove before send.
   - Model picker, thinking picker, plan toggle, context ring.
   - Drafts preserved per session.
6. **Changes and files**
   - Changes panel: git status, additions/deletions, per-file unified diff.
   - Open file in editor, reveal in Finder, copy patch.
   - File browser with git status colors and read-only preview.
   - Refresh on tool completion and window focus, debounced.
7. **Extensions and management**
   - Load all existing pi extensions/packages/skills automatically.
   - Extension dialogs (`select`, `confirm`, `input`, `editor`) inline in a dock,
     with free-text answers for select.
   - `notify` toasts, `setStatus` chips, `setWidget` opt-in drawer, `setTitle`.
   - Extension errors surfaced with path/event and a diagnostics copy.
   - Package list; install/remove/update via `pi` CLI with visible output.
   - MCP: list configured servers and expose `pi mcp` commands; no custom OAuth UI
     in v1.
8. **Auth/providers**
   - Provider login/logout via an in-app pty terminal running `pi auth`.
   - Model list refresh after login; clear auth status; no credential display.
   - Custom providers remain configured through pi (`models.json`/env); document.
9. **Safety**
   - App-owned trust; never write pi trust/session/auth files.
   - Smart approval policy by bundled bridge extension; Ask all / Allow all;
     once/session grants; pending requests do not auto-deny.
   - Plan mode read-only gate.
   - Sensitive-path checks; out-of-workspace warnings.
10. **Platform**
    - macOS menus, traffic lights, notifications, Dock, single instance.
    - Graceful quit with running sessions (warn), child cleanup.
    - Logs under `~/Library/Logs/PiS`; diagnostics panel.
11. **Delivery**
    - `bun run build` → `.app` + `.dmg` (unsigned) in `build/`.
    - `go test ./...`, frontend typecheck/lint/tests, UI visual QA.
    - README, docs, screenshots, known limitations.

### V1 stretch (only if core is solid)

- Todo side panel derived from the `todo` tool and custom entries.
- Inline question cards with option previews.
- Native notifications for background sessions needing input/finishing.
- Session full-text search.
- Mermaid/KaTeX rendering in Markdown (done through the official Streamdown
  Mermaid and math plugins).
- Per-file revert-to-HEAD with confirmation.
- Worktree creation/switching.
- Subagent child-session links and a compact activity panel.

### Explicitly deferred

- Windows/Linux runtime QA (installers and archives are built).
- Apple-signed/notarized macOS releases and a public update feed; ad-hoc
  macOS releases and the GitHub Releases workflow are implemented.
- Remote access/relay, mobile, cloud sync.
- Plugin/marketplace for app-level UI (we use pi packages, not a second plugin
  system).
- Native MCP OAuth UI; full subagent orchestration UI; terminal panel; code
  editor.
- Native menu localization for the Chinese UI.

## 3. Architecture and file layout

```
pis/
├── main.go                     app entry, bindings, menu, window
├── mygo.config.ts              name/id/version, dev/build commands, dist
├── go.mod
├── package.json                bun workspace root; frontend scripts
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── app/                shell, providers, commands
│       ├── components/         sidebar, transcript, composer, dialogs, panels
│       ├── lib/                store, ipc, markdown, diff, fuzzy, format
│       ├── styles/             tokens + Tailwind entry
│       └── mygo.ts             generated typed client (do not edit)
├── vite.config.ts              Vite+ format/lint/type-check config
├── internal/
│   ├── agent/                  RPC process, protocol, coalescer, session runtime
│   ├── sessions/               JSONL index, fast branch transcript, titles
│   ├── workspace/              recents, trust, files, git
│   ├── settings/               app settings, atomic JSON, migrations
│   ├── ptyx/                   login terminal (creack/pty wrapper)
│   ├── picli/                  find pi, version, auth/list/install/mcp commands
│   ├── bridge/                 embedded bridge extension, write-on-version
│   └── util/                   paths, login shell, locks, redaction
├── extensions/
│   └── pis-bridge.ts          tree nav, plan mode, approvals, usage
├── netlify.toml                Netlify docs build configuration
├── docs-user/                  Rspress user guide
├── docs-dev/                   research, decisions, plan, progress, pitfalls, QA
├── resources/                  icon source and licenses
└── scripts/                    dev, check, perf, package helpers
```

Rules:

- `internal/agent` never imports frontend types. Protocol structs are local.
- Go services exposed to the page are thin: validate input, call internal
  packages, return view models. No business logic in binding files.
- The frontend never shells out. All file/process access goes through Go.
- One event envelope per pi session (`AgentEvent`) plus small typed events for
  app state. Frontend maps raw pi events into view state.
- Raw pi payloads cross as JSON (`unknown` in TS) with hand-written types in
  `frontend/src/lib/pi-types.ts`; do not let codegen degrade them to `any`
  silently.

## 4. Phases and acceptance criteria

Each phase ends with a demo and a progress note. Do not start the next phase
with a known red check.

### Phase 0 — Scaffold and contracts
- `mygo init`-equivalent structure; Go module; bun workspace; Vite/React/TS.
- Window opens; generated client works; `bun run dev` live reload.
- Event envelope + service interfaces defined; mock frontend backend.
- Acceptance: `go test ./...` passes; app opens; one typed call round-trips.

### Phase 1 — pi discovery and RPC core
- Find pi via env/PATH/login shell; version check; path setting.
- Process manager: spawn, JSONL parse, command correlation, timeout, stderr
  ring, graceful shutdown, exit events.
- Coalescer for text/thinking deltas; protocol unit tests.
- Acceptance: fake RPC process tests pass; real pi `get_state`/`prompt` works.

### Phase 2 — Sessions and fast transcript
- JSONL index (exclude nested subagent runs), titles, recents, cache.
- Fast active-branch transcript parser with compaction/branch summary.
- Session open/resume/new/rename/delete; one process per open session.
- Sidebar UI with live status.
- Acceptance: measured first paint <150 ms for a 1k-message fixture; resume
  matches pi's `get_messages` for a real session.

### Phase 3 — Chat UI and streaming
- Transcript virtualization, Markdown, code highlighting, thinking, images.
- Tool cards for built-ins with streaming bash and diffs.
- Usage/context/cost, compaction, retries, abort, queue.
- Acceptance: 60 fps streaming test; no O(n²) wire growth; visual QA.

### Phase 4 — Composer and commands
- @file search, slash commands, attachments, model/thinking pickers, drafts.
- Command palette and keyboard model.
- Acceptance: IME/paste/drop tested; commands execute through pi.

### Phase 5 — Extension UI and management
- Dialog dock, notifications, statuses, widgets, errors.
- Package install/remove/update UI via CLI; MCP list/CLI.
- Test against the installed 16-package setup.
- Acceptance: ask-user-question works in RPC; no dialog deadlocks; noise
  contained; extension errors visible.

### Phase 6 — Trust, approvals, plan mode
- Trust detection/dialog/flag; approvals policy; plan mode.
- Bridge extension commands and tests.
- Extension-conflict detection: existing `todo`/`ask_user_question`/plan
  commands/guard packages are never duplicated or shadowed; bridge commands are
  `pis-*`.
- Acceptance: untrusted project does not load local extensions; trusted does;
  approval blocks a destructive command; plan mode blocks writes; no auto-deny;
  with `cc-safety-net` installed our guard defaults off and says so.

### Phase 7 — Changes, files, git
- Status/diff/file preview/open/reveal/copy patch; refresh rules.
- Acceptance: clean/dirty/untracked/binary/deleted cases; large diff cap.

### Phase 8 — Auth and onboarding
- pty login terminal; model refresh; onboarding states.
- Acceptance: fake provider login; cancel/exit; no secret logging; missing pi
  and no-model states have clear paths.

### Phase 9 — Polish, performance, packaging (complete on macOS)
- Native title bar, menus, quit guard, diagnostics, logs.
- Theme/typography/motion pass; empty states; accessibility.
- Budget measurement; `bun run build`; .app smoke.
- Acceptance: budgets met or documented; build launches and opens a session.
- Native completion notifications remain in the V1 stretch list.

### Phase 10 — Delivery (in progress)
- README, docs, screenshots, known limitations, test report.
- Fresh-clone build verification.
- Acceptance: user can run the app and validate against their pi setup.

## 5. Test strategy

- **Go unit**: protocol parser/framer, coalescer ordering, JSONL branch parser,
  session index filtering, trust detection, version parsing, login-shell path,
  permission heuristics, fuzzy file search, settings atomic writes.
- **Go integration**: fake pi RPC process (scripted events) for process manager
  and UI event mapping; real pi smoke for `get_state`, prompt, abort.
- **Frontend unit**: current 9 tests cover transcript/tool pairing, orphan tool
  results, live blocks, usage normalization, todo extraction, and i18n lookup.
  Next: diff parser, fuzzy ranking, command palette, queue state, and a Markdown
  sanitization smoke.
- **Visual**: browser mock backend with fixture sessions for all states;
  actual app screenshot via macOS. Native-window visual QA after the UI
  migration is still pending; mobile is not applicable.
- **Real pi**: one cheap prompt per release check with the configured provider;
  tests never run prompts by default.
- **Performance**: scripted long stream, 1k-message fixture, 10k-line tool output,
  cold/warm launch, idle footprint.
- **Security**: path traversal attempts on UI file methods; untrusted origin
  cannot call IPC; no secrets in logs; project trust off means no project
  extensions.

## 6. Verification commands

```sh
bun install --frozen-lockfile
bun run format
bun run check
```

`bun run check` is the complete gate. It runs Go checks, Vite+ checks, bridge
tests, frontend tests, the frontend build, and the docs build. `scripts/check.sh`
is the implementation of that gate.

## 7. Delivery definition

- Every V1 core item works end to end on macOS arm64.
- The app launches from Finder with a minimal PATH, finds pi, and opens a real
  session with the user's installed extensions.
- No known data-loss or secret-leak path.
- Docs record decisions, progress, pitfalls, corrections, and test results.
- The user can validate the initial version with their own pi account and
  projects; remaining work is listed, not hidden.

## 8. Roadmap after V1

Priority is about release risk, not feature appeal. Do not claim a platform or
provider support level beyond what has been exercised.

**Status 2026-11-24:** P0 validation and performance are complete. P1 daily-use
features are implemented (notifications, MCP, worktrees, session search,
per-file revert, Plan tab, subagent activity, inline question cards). P1 release
engineering has CI, cross-builds, a versioned release workflow, optional
signing, the updater window, a public feed/key, and a verified macOS
0.0.1 → 0.0.2 update. 0.0.3 is prepared. Apple signing is optional. macOS is
ad-hoc signed because no Apple Developer account is available; Gatekeeper
requires one-time approval. P2 localization is implemented for the
English/Chinese shell, with CJK layout QA; native menu labels remain English.

| Priority | Milestone | Exit criteria |
|---|---|---|
| P0 | Validation hardening | User validation pass; fresh real-pi UI smoke after the Base UI/Streamdown migration (prompt, tool card, diff, plan, approval, trust, login); native title bar/traffic-light/menu screenshot; refresh plan/approval screenshots; fix any blockers found. |
| P0 | Performance closure | Profile full 1k-message transcript paint, streaming frame cost, and cached session switch; keep the budgets in ADR-013 or record a deliberate exception. Asset work: use the official Streamdown code/Mermaid plugins (done), verify grammar chunks load only on demand, and keep Markdown lazy. The app is within the 30 MB budget. |
| P1 | Release engineering | Multi-arch Windows/Linux/macOS builds; optional signing/notarization; public update feed and auto-update; fresh-clone CI build; ad-hoc macOS Gatekeeper path. |
| P1 | Daily-use features | Complete: native completion notifications; MCP management; worktrees; subagent activity; session search; per-file revert; todo panel; inline question cards. |
| P2 | Localization | Extract user-facing strings, add a Chinese locale, and run CJK UI QA; keep English as the default. |

Phase 10 closes when the user validates the 0.0.3 artifact. The remaining
delivery items are the 0.0.3 tag and release review, Windows/Linux runtime QA,
and manual deployment of the documentation to Cloudflare Pages and Netlify.
