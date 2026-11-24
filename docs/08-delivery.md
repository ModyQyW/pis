# Public delivery

Status: **0.0.1 and 0.0.2 published** (2026-11-24). The repository and update
feed are public; the signed 0.0.1 → 0.0.2 update installed successfully, and
0.0.2 ships deltas for every target. macOS
is ad-hoc signed and not notarized; Gatekeeper requires a one-time approval.
Windows/Linux runtime QA is still skipped because no test machines are
available.

## Artifact

```text
build/darwin-arm64/PiS.app                  27.0 MB
build/darwin-arm64/pis-0.0.2-arm64.dmg       6.8 MB
build/darwin-amd64/pis-0.0.2-amd64.dmg       7.5 MB
build/linux-amd64/pis-0.0.2-linux-amd64.tar.gz  8.9 MB
build/linux-arm64/pis-0.0.2-linux-arm64.tar.gz  8.5 MB
build/windows-amd64/pis-setup-0.0.2-amd64.exe   7.0 MB
build/windows-arm64/pis-setup-0.0.2-arm64.exe   6.4 MB
```

The build is ad-hoc signed, not notarized. macOS may require
System Settings → Privacy & Security → Open Anyway on first launch.

## Signed release and update feed

The app includes the mygo updater plugin and a Check for Updates menu item.
GitHub Releases can serve updates without an Apple Developer account: mygo
signs update archives with a generated Ed25519 key, and the installed app
verifies that signature. macOS code signing is separate; without a Developer
ID the `.app` is ad-hoc signed and Gatekeeper asks the user to approve it once.
Users can also run `xattr -dr com.apple.quarantine "/Applications/PiS.app"`
after moving it from the DMG. The release repository or feed must be public:
private release assets are not readable by an installed app. Windows builds are
unsigned, so SmartScreen shows its one-time warning; Linux archives include
`install.sh`.

To configure the update key in GitHub:

```sh
./scripts/update-keygen.sh
gh variable set PIS_UPDATE_PUBLIC_KEY < "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub"
gh secret set MYGO_UPDATER_PRIVATE_KEY < "$HOME/Library/Application Support/PiS/update-keys/mygo-update.key"
# Optional; defaults to the repository running the workflow.
gh variable set PIS_UPDATE_GITHUB --body "ModyQyW/pis"
```

The repository and update feed are public. Push a `v*` tag to build the next
release. The workflow creates a draft release; review its assets and publish
it. Never commit the private key.

Build a release from GitHub Actions by pushing a `v*` tag (or dispatching an
existing tag). The workflow creates a draft release, then builds:

- `macos-latest`: `darwin/arm64` and `darwin/amd64`, ad-hoc signed `.app` + DMG
- `ubuntu-latest`: `windows/amd64` and `windows/arm64` with NSIS installers
- `ubuntu-latest`: `linux/amd64` and `linux/arm64` with tar/deb/rpm/install.sh

Actions are pinned to checkout v7, setup-go v7, upload-artifact v7,
download-artifact v8, and action-gh-release v3. The Ubuntu jobs use
`ubuntu-latest`; macOS packaging stays on `macos-latest` because ad-hoc signing
and DMG creation require macOS. The builds upload the update archives and
manifests with `-upload`. Review and publish the draft; the updater reads the
latest published release. A private repository cannot serve this feed to users.
The CI workflow (checkout/setup-go/upload-artifact majors) passed GitHub Actions
run 45155511397, including six cross-builds and a macOS package job.

For a local release with optional Apple signing/notarization:

```sh
./scripts/update-keygen.sh                 # writes a key pair outside the repo
export PIS_VERSION=0.2.0
export PIS_UPDATE_PUBLIC_KEY="$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
export PIS_UPDATE_GITHUB=owner/pis # or PIS_UPDATE_URL=https://…
# Optional Apple credentials; omit both for an ad-hoc macOS build.
# export MACOS_SIGNING_IDENTITY="Developer ID Application: …"
# export MACOS_NOTARY_PROFILE=notary
export MYGO_UPDATER_PRIVATE_KEY_FILE="$HOME/Library/Application Support/PiS/update-keys/mygo-update.key"
./scripts/release.sh -platform "darwin/arm64,darwin/amd64" -upload
```

`scripts/release.sh` strips a leading `v` from the version, never prints the
secret, requires a feed when a public key is set, and refuses a notarization
profile without a signing identity. The keygen output and `*.key` files are
ignored by Git. CI exposes the same inputs as repository variables/secrets
(`PIS_UPDATE_*`, `MYGO_UPDATER_PRIVATE_KEY`, `MACOS_SIGNING_IDENTITY`,
`MACOS_NOTARY_PROFILE`).

Without a public repository or update URL, the updater menu reports that the
build cannot update itself. An installed-update round trip on an ad-hoc signed
macOS app has not been exercised on this machine because the public feed and
update key are not configured; the workflow and manifests are otherwise
supported by mygo.

## Requirements on the validation machine

- pi >= 1.6 < 2 installed and authenticated. The app also finds pi through
  Settings, `PIS_PI`, `PATH`, common install paths, then the login shell.
- Your existing `~/.pi/agent` configuration is used as-is. Existing sessions
  appear under their projects.
- No Node requirement for a standalone pi binary. An npm-installed pi may need
  Node on PATH; PiS resolves the login shell.

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
   If `cc-safety-net` is detected, Settings shows that PiS's guard is off
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
- Screenshots in `docs/images/` were refreshed for PiS: home, chat, plan,
  trust, approval, settings, session tree, diff, login, and both Chinese views.
  `real-pi.png` records the pre-rebrand P0 native run.
- Rspress docs and root config typecheck pass in `./scripts/verify.sh`.
- Releases: [0.0.1](https://github.com/ModyQyW/pis/releases/tag/v0.0.1),
  [0.0.2](https://github.com/ModyQyW/pis/releases/tag/v0.0.2). The 0.0.2
  release includes a signed delta from 0.0.1 for every platform.

## Release checklist (used for 0.0.1 and 0.0.2)

1. **Repository visibility** — **done**: `ModyQyW/pis` is public. An installed
   app cannot read private release assets, so keep the repository or a separate
   release feed public.
2. **Update signing key** — run `./scripts/update-keygen.sh`; store the private
   key in a password manager; set `PIS_UPDATE_PUBLIC_KEY` as a repository
   variable and `MYGO_UPDATER_PRIVATE_KEY` as a repository secret; set
   `PIS_UPDATE_GITHUB` to `ModyQyW/pis` if it does not default correctly.
3. **Platform signing** — Apple Developer ID + notarization removes the macOS
   Gatekeeper warning; a Windows code-signing certificate removes SmartScreen
   warnings. Both are optional, but test the warnings and document them if you
   ship ad-hoc/unsigned builds.
4. **Identity check** — the bundle ID `top.modyqyw.pis` is reverse-DNS for
   `modyqyw.top`; confirm that domain is under your control. Keep the bundle ID,
   Linux package name, and Windows package identity stable after release.
5. **Version and notes** — update `CHANGELOG.md` for the release version,
   confirm `PIS_VERSION` comes from the tag, and review the generated release
   notes for credentials, internal paths, or unfinished claims.
6. **Release dry run** — **done**: `v0.0.1` and `v0.0.2` were built, checked,
   and published with `SHA256SUMS`, manifests, archives, and deltas. Public
   download was proven without authentication.
7. **Update round-trip** — **done on macOS**: the 0.0.1 app was installed and
   the updater installed the signed 0.0.1 → 0.0.2 update into a disposable app
   bundle; the resulting `CFBundleShortVersionString` is 0.0.2. Windows/Linux
   update checks remain unrun.
8. **Runtime QA** — test a clean install and an upgrade on macOS arm64/amd64,
   Windows amd64/arm64, and Linux amd64/arm64. Cover Finder/Explorer launch,
   pi discovery, real session streaming, trust, approvals, login, Chinese UI,
   quit guard, and uninstall/update behavior.
9. **Security and privacy** — scan the tree and release assets for secrets; keep
   `*.key` and update keys out of Git; run `govulncheck` and the frontend
   dependency audit; confirm prompts, credentials, and session contents never
   appear in diagnostics or logs.
10. **License and support** — keep the MIT license, list the supported pi range,
    publish the known limits below, and provide a channel for security reports.

The real-pi UI smoke, native-window check, performance closure, CI, updater
window, P1 daily-use features (including subagent activity and inline questions), and English/Chinese UI are complete for this
build; see `05-qa.md`.

The detailed exit criteria and P1/P2 feature backlog are in `02-plan.md` §8.

## Known limits for this version

- macOS arm64 runtime-validated; Windows/Linux builds untested at runtime.
- macOS is ad-hoc signed and not notarized; auto-update needs a public feed/key.
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
