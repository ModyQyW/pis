# Progress log

Read this before starting work. Update it when a phase starts, when a check
passes/fails, and when a decision changes. Keep entries short and factual.

## Current gate (2026-11-23)

- Research and decisions: complete (2026-11-22).
- Initial implementation: complete enough for user validation on macOS arm64.
- Release build: `build/darwin-arm64/Pi Mygo.app` (22.7 MB) and
  `pi-mygo-0.1.0-arm64.dmg` (5.7 MB); production source maps disabled.
- Real-pi smoke: session resume, streaming, tool cards, plan mode, smart
  approval + deny, trust dialog, provider login pty, changes/diff all exercised
  **before** the Base UI/Streamdown UI migration.
- UI/UX pass: Base UI + shadcn component surface, AI Elements messages,
  Streamdown Markdown with official code and Mermaid plugins, light/dark/browser
  and production-build QA.
- Remaining before a wider release: refresh plan/approval/trust screenshots,
  platform QA, signed/notarized builds, auto-update, native notifications,
  MCP/worktree/subagent panels, i18n.

### Open validation and performance

- Real-pi UI smoke after the UI migration: **pass** (2026-11-23). A disposable
  real pi session rendered Read, Shell, and Edit tool cards, streamed the final
  answer, and the native development window rendered it. Screenshot:
  `docs/images/real-pi.png`.
- Native window check: **pass** for traffic lights, hidden-inset title bar,
  sidebar, composer, and menus; full-screen and dark theme still follow the
  same shell and need no code change. Plan/approval/trust screenshots still
  predate the UI migration.
- Performance closure: **pass** in a throwaway 1,000-item browser harness.
  Rendering after data is ready took 3 ms; parser was previously 3.5 ms for
  1,000 messages. Cached session switch took 32 ms cold / 19 ms warm; 60
  streamed row updates had median <1 ms (max 1 ms); 20 rows were mounted.
- macOS symlink canonicalization now prevents duplicate recents
  (`/tmp` vs `/private/tmp`); unit tests cover the path and dedupe.
- Production assets are 17 MB / 400 lazy chunks; the 25.3 MB app is within the
  30 MB budget, so grammar/diagram chunk trimming is not a release blocker.

### Next milestones

1. **P0 validation hardening** — user validation, fresh real-pi UI smoke,
   native-window visual check, remaining screenshots, fix blockers.
2. **P0 performance closure** — profile and record the three open budget items.
3. **P1 release engineering** — Windows/Linux probes, signing/notarization,
   auto-update, fresh-clone CI.
4. **P1 daily-use features** — notifications, MCP, worktrees, subagents,
   search, per-file revert, todo panel.
5. **P2 localization** — string extraction and Chinese UI.

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
| 10 Delivery | In progress | docs and roadmap refreshed; user validation and P0 hardening pending |

## Evidence log

### Shell and performance

- Release app (with all frontend assets, without pi): **22.7 MB**, DMG
  **5.7 MB**. Removing production source maps cut 21 MB from the embedded
  frontend; the `.app` was 43.8 MB with maps enabled.
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

### Transcript virtualization and dependencies

- 2026-11-23: `react-virtuoso` replaced with `@tanstack/react-virtual` 3.14.28.
  Dynamic measurement, pinned-end streaming, append follow, scroll-up release,
  and jump-to-latest verified in a 300-row browser harness (16 rows mounted at
  bottom). Typecheck, 5 Vitest tests, and production build pass.
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
| Bundle excl. pi | < 30 MB | 25.3 MB `.app`; 6.2 MB DMG |
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
