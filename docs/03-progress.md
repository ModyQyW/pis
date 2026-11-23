# Progress log

Read this before starting work. Update it when a phase starts, when a check
passes/fails, and when a decision changes. Keep entries short and factual.

## Current gate (2026-11-23)

- Research and decisions: complete (2026-11-22).
- Initial implementation: complete enough for user validation on macOS arm64.
- Release build: `build/darwin-arm64/Pi Mygo.app` (27.0 MB) and
  `pi-mygo-0.1.0-arm64.dmg` (6.8 MB); production source maps disabled.
- Real-pi smoke: session resume, streaming, tool cards, plan mode, smart
  approval + deny, trust dialog, provider login pty, changes/diff were exercised
  before the Base UI/Streamdown UI migration; the post-migration native session
  is recorded under Open validation below.
- UI/UX pass: Base UI + shadcn component surface, AI Elements messages,
  Streamdown Markdown with official code and Mermaid plugins, light/dark/browser
  and production-build QA.
- Remaining before a wider release: refresh plan/approval screenshots, a public
  update feed/key, and runtime QA on Windows/Linux. macOS is ad-hoc signed and
  requires a one-time Gatekeeper approval.

### Open validation and performance

- Real-pi UI smoke after the UI migration: **pass** (2026-11-23). A disposable
  real pi session rendered Read, Shell, and Edit tool cards, streamed the final
  answer, and the native development window rendered it. Screenshot:
  `docs/images/real-pi.png`.
- Native window check: **pass** for traffic lights, hidden-inset title bar,
  sidebar, composer, and menus; full-screen and dark theme still follow the
  same shell and need no code change. Plan and approval screenshots still
  predate the UI migration; the trust dialog is current.
- Performance closure: **pass** in a throwaway 1,000-item browser harness.
  Rendering after data is ready took 3 ms; parser was previously 3.5 ms for
  1,000 messages. Cached session switch took 32 ms cold / 19 ms warm; 60
  streamed row updates had median <1 ms (max 1 ms); 20 rows were mounted.
- macOS symlink canonicalization now prevents duplicate recents
  (`/tmp` vs `/private/tmp`); unit tests cover the path and dedupe.
- Production assets are 17 MB / 400 lazy chunks; the 27.0 MB app / 6.8 MB DMG
  is within the 30 MB budget, so grammar/diagram chunk trimming is not a
  release blocker.

### Next milestones

1. **P0 validation hardening / performance** — complete on 2026-11-23; refresh
   remaining screenshots when the UI freezes.
2. **P1 daily-use features** — complete: notifications, MCP configuration,
   worktrees, session text search, per-file revert, the Plan/todo tab, a
   subagent activity list, and inline question cards.
3. **P1 release engineering** — CI, cross-builds, versioned release workflow,
   optional signing/notarization, the updater window, and
   `scripts/release.sh`/`update-keygen.sh` are implemented. A public update
   feed/key still need a public release host. macOS is ad-hoc signed; Windows/
   Linux artifacts build but have no runtime QA yet.
4. **P2 localization and assets** — complete: English/Chinese UI, CJK QA, and
   official Streamdown code/Mermaid lazy chunks within the app budget.

Exit criteria and detailed scope are in `02-plan.md` §8.

## Phase status

| Phase | Status | Evidence / notes |
|---|---|---|
| Research | Done | `00-research.md`; repos cloned and prototypes measured |
| Decisions | Done | `01-decisions.md`; all round-1 answers accepted |
| 0 Scaffold | Done | mygo v0.10.0; Vite/React; typed client; real window/menu |
| 1 RPC core | Done | real pi start/state in 2.06s; coalescer + protocol tests |
| 2 Sessions/transcript | Done | 246 entries/13ms; 18 sessions/56ms; subagent runs excluded |
| 3 Chat UI | Done | real streaming, tool cards, diffs, thinking, usage, compaction |
| 4 Composer/commands | Done | @file, slash commands, attachments, model/thinking picker |
| 5 Extension UI | Done | dialogs, fire-and-forget, status rail, errors, login terminal |
| 6 Trust/approvals/plan | Done | app trust + `--approve`; smart approval; read-only plan mode |
| 7 Changes/files | Done | git status/diff, file list/preview, copy patch, reveal |
| 8 Auth/onboarding | Done | pty login; missing-pi/no-model banners; provider settings |
| 9 Polish/package | Done | app/DMG built; performance measured; Markdown lazy; source maps off |
| 10 Delivery | In progress | P0/P1 features, CI, and i18n done; signing/feed and screenshot refresh pending |

## Evidence log

### Shell and performance

- Release app (with all frontend assets, without pi): **27.0 MB**, DMG
  **6.8 MB**. Removing production source maps cut 21 MB from the embedded
  frontend; the `.app` was 43.8 MB with maps enabled before the plugin and
  feature additions.
- Warm launch from Finder-like `open`: **0.413 / 0.422 / 0.432 s** (three runs;
  median 0.422 s). One cold run immediately after a rebuild took 0.857 s.
- Idle physical footprint with no pi session: **42 MB** app process. WebKit
  helpers add their own footprint; total is within the 120 MB budget.
- Frontend production bundle: main chunk 595 KB (~189 KB gzip), lazy login
  chunk 338 KB (86 KB gzip), lazy Markdown/official plugin chunk 1.13 MB
  (348 KB gzip), CSS 118 KB (24 KB gzip). Shiki grammar and Mermaid chunks load
  on demand; 400 lazy assets total, dist 17 MB. No source maps in production.
  A Vite chunk-size warning remains for the lazy Markdown chunk; it does not
  delay the first paint.
- `go test ./...`, `go vet ./...`, `bun run typecheck`, `bun run test`, and
  `bun run build` pass. Production assets loaded in a clean browser with no
  console errors; code, table, inline math, and Mermaid rendered.

### pi and sessions

- RPC start with the installed 16 packages: ~2.06 s to `get_state`.
- Real session resumed: 246 entries parsed in **13 ms**; a synthetic
  1,000-message session parses in **3.5 ms**; 18 workspace sessions listed in
  **56 ms**.
- Real 195-line session rendered Markdown, tool cards, and a diff; a real RPC
  prompt returned `OK` and streamed into the transcript.
- Tree navigation `/mygo-navigate a2` changed `get_entries.leafId` from the
  file leaf to `a2`; the bridge command returned `handled`.
- Plan mode `/mygo-plan on` returned `handled`, set `mygo:plan=plan`, and
  reduced the model's tool list to read-only tools plus guarded bash.
- Smart approval: `rm -rf` produced an `Allow bash?` select with the command and
  risk reason; Deny blocked the tool and the assistant reported it.
- Trust: a project with `.pi/extensions` and `.pi/settings.json` showed the
  app's trust dialog; trusting started a session with local extensions loaded.

### Auth

- pty unit test: prompt -> input -> echo -> exit 0 passes.
- Login dialog renders a real xterm terminal; mock mode exercises the UI.
- Credentials are never logged by the app; the terminal buffer is in memory.

### P1 features and release plumbing

- **Session search**: Go scans the active branch of recent sessions, returns a
  context snippet, and the command palette debounces queries and opens a hit.
  `TestSearchFindsActiveBranchText` covers case-insensitive matching and role.
- **Plan tab**: `extractTodos` reads pi's `rpiv-todo-state` custom entries and
  todo tool result details; two Vitest cases cover latest-state replacement and
  details.todos. Progress is shown in the right panel.
- **MCP**: `internal/mcp` merges user/project `mcp.json`, preserves unknown
  fields, and supports add/enable/remove with atomic writes. Tests cover merge,
  override, and local enable. The settings dialog opens a manager.
- **Worktrees**: `gitx.Worktrees/AddWorktree/RemoveWorktree` parse porcelain
  output and canonicalize paths. Integration test creates, lists, and removes a
  linked worktree; the command palette opens the manager.
- **Per-file revert**: `Git.Revert` restores tracked paths from HEAD and refuses
  untracked files; integration test verifies a staged change is undone. The
  changes panel adds a hover action behind a destructive confirmation.
- **Subagents/questions**: `extractSubagents` pairs subagent tool calls with
  results and live blocks; the right panel has an Agents tab. `parseQuestions`
  turns `ask_user_question` arguments into an inline card and marks selected
  answers. Vitest covers both.
- **Notifications**: `Desktop.Notify` respects the setting, groups by session,
  and truncates text. The packaged app's Test notification raised the macOS
  authorization prompt (verified in `docs/images/settings.png` capture session).
- **Assets**: production build has 400 lazy language/diagram chunks, but a
  clean session loaded only 15 `/assets/` files on first code/Mermaid render;
  no console errors. The Markdown chunk stays 1.13 MB lazy (348 KB gzip).
- **Localization**: `lib/i18n.ts` provides `t()` with English source keys,
  Chinese copy, placeholders, and a root locale subscription; Settings persists
  `language`, and `mygo.App.SetLocale` follows it for the native shell. Nine
  Vitest tests include translation lookup and placeholders; CJK screenshots are
  in `docs/images/zh-chat.png` and `zh-settings.png`.
- **Release**: `.github/workflows/ci.yml` runs on `ubuntu-latest` for Go,
  cross-builds, frontend tests, and `macos-latest` for ad-hoc macOS packages.
  Actions use checkout v7, setup-go v7, upload-artifact v7, download-artifact
  v8, and action-gh-release v3. GitHub Actions run 45153414759 passed all Go,
  frontend, six cross-build, and macOS package jobs. The release workflow builds
  darwin arm64+amd64,
  windows amd64+arm64 (NSIS from Ubuntu), and linux amd64+arm64, then uploads
  through mygo to a draft release. A local Ubuntu 24.04 container built all
  Linux/Windows targets and both installers successfully; local macOS builds
  produced both DMGs. macOS update manifest generation was exercised with a
  temporary Ed25519 key. `release.yml` builds tagged artifacts with optional
  signing/notarization and updater key variables. `mygo.Use(updater.Plugin)` and
  a Check for Updates menu item are wired; `scripts/release.sh` validates
  version/feed/signing inputs without printing secrets, and
  `scripts/update-keygen.sh` generates the Ed25519 pair outside the repo. The
  no-credential release build and keygen path were exercised; no public feed is
  configured.
- **Version**: `mygo.config.ts` reads `PI_MYGO_VERSION`; `main.go` no longer
  hard-codes 0.1.0. Local builds still default to 0.1.0.

### Transcript virtualization and dependencies

- 2026-11-23: `react-virtuoso` replaced with `@tanstack/react-virtual` 3.14.28.
  Dynamic measurement, pinned-end streaming, append follow, scroll-up release,
  and jump-to-latest verified in a 300-row browser harness (16 rows mounted at
  bottom). Typecheck, 13 Vitest tests, and production build pass.
- Direct dependencies updated to latest (`katex` 0.19.1); lockfile updated.
  Math and GFM table rendering verified after the update; KaTeX CSS 0.19.1
  resolves beside Streamdown's own KaTeX 0.16.47 (recorded in P-055).
- 2026-11-23: Markdown now uses the official `@streamdown/code` and
  `@streamdown/mermaid` plugins. Pele and the bespoke Shiki highlighter were
  removed; code, table, math, and Mermaid rendered in a clean browser harness
  with lazy grammar/diagram chunks.

### Documentation

- 2026-11-23: status snapshot, open validation/performance items, and the
  P0/P1/P2 roadmap were added to `02-plan.md` §8 and this log. No code or
  artifact changed in this pass.

## Budgets

| Metric | Budget | Measured |
|---|---|---|
| Warm window visible | < 700 ms | 0.422 s median of three runs; 0.857 s cold |
| First transcript paint, 1k msgs | < 150 ms | 3.5 ms JSONL parse + 3 ms transcript render after data ready |
| Streaming frame cost | < 8 ms | median <1 ms, max 1 ms over 60 row updates |
| Idle footprint excl. pi | < 120 MB | 42 MB app process; WebKit helpers not summed |
| Idle CPU | ~0% | observed ~0% after settle |
| Bundle excl. pi | < 30 MB | 27.0 MB `.app`; 6.8 MB DMG |
| Cached session switch | < 100 ms | 32 ms cold / 19 ms warm |

## Corrections

- Plan mode initially removed `bash` from the tool set. The bridge now keeps
  `bash` and blocks mutating commands in plan mode, so the model can still
  inspect the project.
- `openSummary` had a race: the fast transcript could resolve after the temp
  session key was replaced. It now awaits the transcript before migration and
  merges whichever entries won.
- Usage-less synthetic sessions made a user extension throw on `totalTokens`;
  fixtures now include usage, and frontend usage rendering normalizes/guards.
- Every `extension_ui_request` was initially treated as an error. The UI now
  splits fire-and-forget status/widget/notify from blocking dialogs.
- The release app's empty state showed the selected project twice; the sidebar
  now merges the selected workspace into the project list once.
- Approval text initially showed the regex source; it now uses human labels
  such as "recursive delete".
- Production source maps were enabled; they inflated the embedded frontend by
  21 MB. Vite now emits none for production.
- The UI layer was migrated to Base UI/shadcn/AI Elements, and Markdown to
  Streamdown with its official code/Mermaid plugins. The shadcn `muted` surface
  token had collided with the app's muted text token; app text now uses
  `subtle`.
- Keyboard labels promised actions that were not wired (tree, compact, model)
  and "Esc stops" did not stop. All advertised shortcuts and Esc now work.
- New chat after an active session showed a blank transcript instead of the
  starter cards; blank live sessions now show the same home state.
