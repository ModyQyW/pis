# Testing

[English](testing.md) | [简体中文](testing.zh.md)

PiS has five test layers: frontend unit tests, bridge tests, Go tests, real pi tests, and manual QA.

Full gate:

```sh
bun run check
```

Frontend only:

```sh
bun run test
bun run test:bridge
bun run check:web
```

## Layers

| Layer | Command | Coverage |
|---|---|---|
| Frontend unit | `bun run test` | Session state, transcript, i18n, questions, todos, subagents |
| bridge | `bun run test:bridge` | Approval rules, plan mode, path checks |
| Go unit | `go test ./internal/... .` | Settings, trust, sessions, MCP, pi configuration, files, Git, auth, process |
| Real pi | `PIS_INTEGRATION=1 ...` | RPC start, state, commands, real session |
| Manual QA | `bun run dev` | Interface, tools, approvals, layout, and cross-platform behavior |

`bun run check` also runs:

- Go format check.
- Go build and vet.
- Vite+ format, lint, and type checks.
- Production frontend build.
- User documentation build in English and Chinese.

## Frontend unit tests

The config is `frontend/vitest.config.ts`. The environment is jsdom. Tests are in `frontend/src/**/*.test.ts`.

Current coverage:

- `store/chat.test.ts`: failed send restores the draft, close during start, late events after close, dialog dismiss.
- `lib/transcript.test.ts`: tool pairing, orphan tool results, live blocks, compaction, extension messages.
- `lib/i18n.test.ts`: translation fallback and interpolation.
- `lib/questions.test.ts`: question parsing and answer matching.
- `lib/todos.test.ts`: todo state extraction.
- `lib/subagents.test.ts`: subagent call and result pairing.

When you add a test:

- Test at the behavior boundary.
- Mock IPC.
- Test failure paths and data-loss paths.
- Make sure the test fails when the behavior breaks.

There is no full DOM test framework for components. Check interaction-heavy UI in a browser by hand.

## bridge tests

File: `internal/bridge/bridge.test.ts`.

The test uses Bun and a fake `ExtensionAPI`. Coverage:

- Destructive commands trigger approval.
- Plan mode blocks `mkdir` and `git push`.
- `../` and `$HOME` paths trigger the workspace check.
- Sensitive files trigger approval, for example `.env`, SSH private keys, and `auth.json`.

The bridge runs in the pi process. Tests must use a fake `pi` object. Do not load real pi.

## Go tests

Run by package:

```sh
go test ./internal/...
```

Coverage:

- `app`: project path normalization and recent project deduplication.
- `auth`: pty input, output, and exit.
- `files`: file ranking and symlink boundaries.
- `gitx`: status parsing, rename stats, diff, revert, worktree lifecycle, dirty worktree removal.
- `mcp`: merge, override, add, enable, remove, unknown field preservation, duplicate name rejection.
- `piconf`: pi settings and provider reads, key redaction, atomic writes, unknown field preservation, skill discovery, corrupt-file write refusal.
- `piinfo`: version parsing, supported range, path discovery.
- `sessions`: active branch, nested subagent exclusion, search, summary cache refresh.
- `settings`: defaults, damaged file, migration, validation, snapshot isolation.
- `trust`: resource detection, ancestor `.agents/skills`, user global skill exclusion, pi trust record.
- `agent`: delta coalescing, record read limit.

Git tests need `git` on the machine. They skip when Git is missing.

## Real pi tests

Start and inspect real pi:

```sh
PIS_INTEGRATION=1 go test ./internal/agent -run TestStartAndInspectRealPi
```

The test starts a real pi process, reads state and commands, then closes the session. It sends no prompt and uses no model call.

Read a real session:

```sh
PIS_SESSION_FILE=/path/to/session.jsonl go test ./internal/sessions -run TestReadRealSession -v
PIS_WORKSPACE=/path/to/project go test ./internal/sessions -run TestListRealWorkspace -v
```

These tests only read files. They do not change sessions.

## Manual QA

Use real pi and a real project. Check:

- Install and first start.
- pi path detection and version warning.
- Provider sign-in.
- New, resume, rename, fork, clone, and session tree.
- Streaming text, thinking blocks, code blocks, Mermaid, math, and images.
- Tool cards: shell, read, edit, write, grep, find, ls, todo, subagent.
- Approvals: allow once, allow for session, deny.
- Plan mode: read-only tools and change blocking.
- Project trust: deny, allow, restart session.
- Changes panel: diff, copy patch, revert, file preview.
- Pi configuration: the confirmation banner appears on a changed configuration; defaults, provider, skill path, and package changes write pi's files; stored keys stay hidden.
- MCP: add, enable, remove, reload session.
- Worktrees: create, open, remove, dirty worktree second confirmation.
- Extension dialogs, statuses, and widgets.
- Settings: theme mode, all four palettes, language, font size, send key, notifications.
- Quit guard: running session warning.
- Update check and Gatekeeper flow.

Platform checks:

- macOS arm64 is the main validated platform.
- Windows and Linux builds need runtime checks on real machines.

## Browser checks

For frontend-only changes, use browser mode:

```sh
bun run dev:web
```

Check:

1. Text and input in Settings.
2. Code font size affects Markdown code blocks, diff, tool output, and previews.
3. Dialogs stay inside the window after interface scaling.
4. With Send on Enter off, Enter adds a line and `⌘Enter` sends.
5. Dark and light modes for each palette.
6. Focus rings are visible and body text and labels keep the 4.5:1 contrast floor.
7. At 900 px and below, the sidebar overlays with a scrim and closes after a selection; at 1100 px and below, the right panel becomes a sheet.
8. Chinese interface has no obvious English leftovers.

Browser mode uses mock data. It does not replace a real pi test.

## Verification record

Last full macOS arm64 validation: 2026-11-22 to 2026-11-24.

| Area | Result |
|---|---|
| Go build, vet, tests | Pass |
| Vite+ format, lint, type checks | Pass |
| Frontend tests | Pass |
| Production frontend build | Pass |
| Documentation build | Pass, 32 pages in English and Chinese |
| Warm window | 0.422 s median of three runs |
| Idle footprint | 42 MB physical, no pi session |
| Real transcript | 246 entries in 13 ms |
| 1,000-message fixture | 3.5 ms |
| 18-session list | 56 ms |
| Real pi start | 2.06 s including installed packages |
| Real streaming prompt | Pass |
| Real plan mode | Pass; mutating tools blocked |
| Real smart approval | Pass; `rm -rf` asked, Deny blocked |
| Real trust flow | Pass; local extension loaded after trust |
| Login pty | Pass; prompt, input, echo, exit |
| Changes, diff, tree, search | Pass |
| DMG for 0.0.5 arm64 | 7.2 MB |
| DMG for 0.0.6 arm64 | 7.2 MB |
| DMG for 0.0.7 arm64 | 7.2 MB |

These numbers are historical. They describe the machine and build above. Re-run the gate and the relevant manual checks before a release.

Platform gaps:

- Windows and Linux runtime QA: skipped. No local machines.
- macOS amd64 runtime QA: skipped. The local host is arm64.
- Packaged WKWebView UI: manual check only.

## Performance checks

The performance budget is in ADR-013. The verification record above holds the last measurements.

Measure again when you change:

- Session first paint.
- Session list scan.
- Command palette search.
- Streaming text updates.
- Memory and scrolling in a long session.

The budget is not an automated test. When you measure, record:

- Data size.
- Machine and OS.
- Cold or warm cache.
- Command.
- Result.

## CI

`.github/workflows/ci.yml` runs:

- Go format, build, vet, and tests.
- Six cross-compile targets.
- Frontend format, lint, type checks, bridge tests, Vitest, and build.
- Documentation build.
- macOS app package.

`.github/workflows/release.yml` runs the release flow. It does not publish a draft.

## Known gaps

- Windows and Linux lack full runtime QA.
- The packaged WKWebView has no automated UI test.
- The update install path needs manual verification.
- Component-level DOM tests are not set up.

Record a gap and its check scope in the pull request and the release checklist.

## Related

- [Local development](development.md)
- [Architecture and data flow](architecture.md)
- [Feature implementation](features.md)
- [Release](release.md)
