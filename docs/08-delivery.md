# Initial delivery

Status: ready for user validation on macOS arm64 (2026-11-23). A wider release
is blocked on signed/notarized builds, a public update feed/key, and the
plan/approval screenshot refresh. The P0 real-pi, native-window, and performance
checks are complete.

## Artifact

```text
build/darwin-arm64/Pi Mygo.app            27.0 MB
build/darwin-arm64/pi-mygo-0.1.0-arm64.dmg  6.8 MB
```

The build is ad-hoc signed, not notarized. macOS may require
System Settings → Privacy & Security → Open Anyway on first launch.

## Signed release and update feed

The app includes the mygo updater plugin and a Check for Updates menu item.
To build a distributable release, provide credentials and a public feed:

```sh
./scripts/update-keygen.sh                 # writes a key pair outside the repo
export PI_MYGO_VERSION=0.2.0
export PI_MYGO_UPDATE_PUBLIC_KEY="$(cat "$HOME/Library/Application Support/Pi Mygo/update-keys/mygo-update.pub")"
export PI_MYGO_UPDATE_GITHUB=owner/pi-mygo # or PI_MYGO_UPDATE_URL=https://…
export MACOS_SIGNING_IDENTITY="Developer ID Application: …"
export MACOS_NOTARY_PROFILE=notary
export MYGO_UPDATER_PRIVATE_KEY_FILE="$HOME/Library/Application Support/Pi Mygo/update-keys/mygo-update.key"
./scripts/release.sh
```

`scripts/release.sh` strips a leading `v` from the version, never prints the
secret, requires a feed when a public key is set, and refuses a notarization
profile without a signing identity. The keygen output and `*.key` files are
ignored by Git. CI exposes the same inputs as repository variables/secrets
(`PI_MYGO_UPDATE_*`, `MYGO_UPDATER_PRIVATE_KEY`, `MACOS_SIGNING_IDENTITY`,
`MACOS_NOTARY_PROFILE`).

Without a public repository or update URL, the updater menu reports that the
build cannot update itself. A signed/notarized build and an installed-update
round trip have not been exercised on this machine because those credentials
and the public feed are not present.

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
- Frontend typecheck, 13 Vitest tests, production build pass.
- P1 UI pass: session text search, Plan tab, MCP manager, worktree manager,
  per-file revert confirmation, and notification test button exercised in a
  clean browser.
- Go tests cover session search, MCP merge/override, worktree lifecycle, and
  per-file revert; cross-builds for linux/amd64, linux/arm64, windows/amd64, and
  darwin/arm64 pass.
- The packaged app's Test notification raised the macOS notification
  authorization prompt.
- English/Chinese UI switch with CJK QA; screenshots in `zh-chat.png` and
  `zh-settings.png`. Native menu names remain English.
- Release `.app` 27.0 MB, DMG 6.8 MB; no production source maps.
- Screenshots in `docs/images/` were refreshed for chat, session tree, diff, and
  login after the UI migration. `real-pi.png` records the P0 native run.

## Next before a wider release

1. **User validation** — install, launch, and run the five-minute checklist
   against a real pi account and project.
2. **Screenshot refresh** — refresh the plan and approval images after the UI
   migration; trust is current.
3. **Signing and update feed** — provide an Apple Developer ID and notarization
   profile, choose a public release host, and set the updater public key/URL.
The real-pi UI smoke, native-window check, performance closure, CI, updater
window, P1 daily-use features (including subagent activity and inline questions), and English/Chinese UI are complete for this
build; see `05-qa.md`.

The detailed exit criteria and P1/P2 feature backlog are in `02-plan.md` §8.

## Known limits for this version

- macOS arm64 only validated; Windows/Linux untested.
- Unsigned/unnotarized, no auto-update.
- RPC extension UI subset: no `ctx.ui.custom()` TUI components, custom editors,
  terminal input, or theme switching. Dialogs/status/widgets/notify work.
- Native menu names stay English in Chinese mode.
- Auto-update is wired but has no public feed or signing key; the build is
  ad-hoc signed and not notarized.
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
- What is missing for daily use: terminal, editor, richer subagent controls?
