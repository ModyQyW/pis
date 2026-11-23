# Initial delivery

Status: ready for user validation on macOS arm64 (2026-11-23). A wider release
is blocked on the P0 items in `02-plan.md` §8: fresh real-pi UI smoke,
native-window visual check, and performance closure.

## Artifact

```text
build/darwin-arm64/Pi Mygo.app            22.7 MB
build/darwin-arm64/pi-mygo-0.1.0-arm64.dmg  5.7 MB
```

The build is ad-hoc signed, not notarized. macOS may require
System Settings → Privacy & Security → Open Anyway on first launch.

## Requirements on the validation machine

- pi >= 1.6 < 2 installed and authenticated. The app also finds pi through
  Settings, `PI_MYGO_PI`, `PATH`, common install paths, then the login shell.
- Your existing `~/.pi/agent` configuration is used as-is. Existing sessions
  appear under their projects.
- No Node requirement for a standalone pi binary. An npm-installed pi may need
  Node on PATH; Pi Mygo resolves the login shell.

## Five-minute validation

1. Open the app. It restores the last workspace and, if one was used, the last
   session. If pi is missing, the banner offers Locate pi / Install guide.
2. Settings (⌘,) → Providers → Sign in to a provider. The dialog runs pi's own
   `auth login` in a terminal. Cancel leaves credentials untouched.
3. Open a project with `.pi/` resources. The trust dialog lists what will load;
   trust the project. New sessions pass `--approve`; existing sessions keep
   their old decision until restarted.
4. New chat. Send a task. Verify streaming Markdown, thinking, tool cards,
   live shell output, usage/context, and diffs on edit. Also try a short table,
   inline math, and a Mermaid block; external links must open the system
   browser, not replace the app page.
5. Open Changes (⌘⇧G). Click a file to inspect the unified diff; Copy patch.
6. Turn Plan on. Ask for a plan; mutating tools are blocked. Turn Plan off.
7. Ask to run a destructive command. With Smart approvals and no other guard,
   an approval dock shows the command and risk. Deny; the tool is blocked.
   If `cc-safety-net` is detected, Settings shows that Pi Mygo's guard is off
   unless you enable it.
8. Session menu: rename, clone, session tree, compact, export HTML, reveal,
   close, delete to Trash.
9. On a session with history, hover a user message → Fork from here.
10. Quit while a run is active: a native dialog offers Cancel / Quit and Stop.

Screenshots: `docs/images/`.

## Evidence

- Go build/vet/tests pass.
- Frontend typecheck, 5 Vitest tests, production build pass.
- Production UI pass: Base UI dialogs/menus, AI Elements messages, Streamdown
  code/table/math, official Mermaid plugin, light/dark themes, external-link
  routing, and the main shortcuts were exercised in a clean browser; no console
  errors.
- Real pi RPC start ~2.06 s; real prompt streamed `OK`.
- P0 real-pi UI smoke: disposable session rendered Read/Shell/Edit tool cards and
  streamed output in the native window (`docs/images/real-pi.png`).
- P0 performance: 1,000-item render 3 ms after parse; session switch 32/19 ms;
  streamed update max 1 ms; 20 rows mounted.
- Workspace paths are canonicalized, so `/tmp` and `/private/tmp` sessions share
  one project entry.
- Real plan mode, smart approval + deny, trust dialog + local extension load.
- Real tree navigation changes `get_entries.leafId`.
- 246-message session in 13 ms; 1,000-message parser in 3.5 ms.
- Warm window 0.422 s median; idle physical footprint 41–42 MB without pi.
- pty login unit test passes.
- Release `.app` 22.7 MB, DMG 5.7 MB; no production source maps.
- Screenshots in `docs/images/` were refreshed for chat, session tree, diff, and
  login after the UI migration.

## Next before a wider release

1. **User validation** — install, launch, and run the five-minute checklist
   against a real pi account and project.
2. **Screenshot refresh** — refresh the plan, approval, and trust images after
   the UI migration.
3. **Release engineering** — Windows/Linux probes, signed/notarized macOS,
   auto-update, and fresh-clone CI.

The real-pi UI smoke, native-window check, and performance closure are complete
for this build; see `05-qa.md`.

The detailed exit criteria and P1/P2 feature backlog are in `02-plan.md` §8.

## Known limits for this version

- macOS arm64 only validated; Windows/Linux untested.
- Unsigned/unnotarized, no auto-update.
- RPC extension UI subset: no `ctx.ui.custom()` TUI components, custom editors,
  terminal input, or theme switching. Dialogs/status/widgets/notify work.
- No MCP management UI, worktree manager, subagent activity board, native
  completion notifications, or Chinese UI yet.
- Approvals and plan mode are product-level guardrails, not a sandbox. Use an
  OS boundary or container when you need one.
- The app relies on pi's session files for history display; it never writes
  them. Some custom entries are intentionally not rendered.

## Feedback to collect

- Did pi, the project, and the session list load without setup friction?
- Did streaming and scrolling stay smooth on a long answer/tool output?
- Were tool cards, diffs, and the changes panel readable and useful?
- Did extension dialogs/statuses behave, and were any noisy?
- Was trust/approval wording clear? Did any guard double-prompt?
- Did plan mode match your workflow?
- What is missing for daily use: MCP, worktrees, subagents, notifications,
  search, terminal, editor?
