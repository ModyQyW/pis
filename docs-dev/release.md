# Build, sign, and release

[English](release.md) | [简体中文](release.zh.md)

## Current state

- The current tag is `v0.0.11`.
- `0.0.11` is the public release and the latest release.
- macOS uses an ad-hoc signature. The Windows installer is unsigned. Linux uses tar, deb, rpm, and `install.sh`.

Before a release, confirm the state with `git tag` and `gh release list`.

## Version and updates

Updates use GitHub Releases and an Ed25519 key.

The release flow generates update files:

- An update archive for each platform.
- A manifest for each platform.
- `SHA256SUMS`.

Deltas are off (`updates.deltas: 0`): updates download the full archive, and the release asset list stays short.

The update public key must be set at build time. An installed old version uses the key to verify a new version.

## Before a release

Requirements:

- On the `main` branch.
- A clean working tree.
- `main` contains the source to release.
- `gh` is signed in with release permission.
- The CI secret and variables below are set.

```sh
gh auth status
git status
git log --oneline -5
```

Configuration:

| Name | Type | Purpose |
|---|---|---|
| `PIS_UPDATE_PUBLIC_KEY` | variable | Update public key |
| `MYGO_UPDATER_PRIVATE_KEY` | secret | Update private key |
| `PIS_UPDATE_GITHUB` | variable | Repository, for example `ModyQyW/pis` |
| `MACOS_SIGNING_IDENTITY` | secret | Optional Apple signing identity |
| `MACOS_NOTARY_PROFILE` | secret | Optional notarytool profile |

Without the update private key, the build skips update archives. Users can install a new version, but the update feed is incomplete.

Keep the private key outside the repository and back it up. If you lose the key, installed users cannot verify new versions.

## One-shot release

```sh
./scripts/release.sh
```

The script asks for a version. Press Enter to accept the suggested patch version.

Non-interactive:

```sh
PIS_VERSION=0.0.11 ./scripts/release.sh
```

The script:

1. Checks the branch, working tree, and `gh` sign-in.
2. Fast-forwards to `origin/main`.
3. Installs dependencies and runs `bun run check`.
4. Generates the CHANGELOG section.
5. Changes the default version in `mygo.config.ts`.
6. Commits `chore(release): prepare <version>`.
7. Pushes `main`, creates the `v<version>` tag, and pushes it.
8. Waits for the Release workflow.
9. Checks the draft assets and `SHA256SUMS`.
10. Prepends the download header and extracts the CHANGELOG section for the release notes.
11. Publishes the draft and sets it as latest.
12. Checks `isDraft`, `isLatest`, and `publishedAt`.

If the tag exists and points to `HEAD`, the script continues from the workflow wait. It does not commit or tag again. If no Release workflow run appears for the tag, the script fails after a minute; start it manually with `gh workflow run release.yml -f version=v<version>`.

## CHANGELOG

The CHANGELOG is the only release record. The script writes the target version section from commits between the previous `v*` tag and `HEAD`.

Filter rules:

- Remove `chore(release): prepare <version>`.
- Remove the legacy `Prepare <version> release` and `Record <version> publication` lines.
- Remove duplicate lines.

If the target version section already exists, the script keeps the manual text.

At publish time, the script prepends the download header in `scripts/release-notes-header.md`, then extracts the matching CHANGELOG section to a temporary file. The header links each download row to its release asset. Link text uses `PISVERSION`; URLs use `__VERSION__`. `release.sh` replaces both tokens. Double underscores in link text become Markdown emphasis, so do not use them there. It passes that file to `gh release edit --notes-file`. The assembled notes file does not enter Git; the header template does.

The Chinese CHANGELOG is `CHANGELOG.zh.md`. Add the same version section before you run the script. You can leave that edit uncommitted; the script commits it with the English section. It stops if the Chinese section is missing.

## Release workflow

`release.yml` runs from a tag or a manual trigger.

Jobs:

| Job | Purpose |
|---|---|
| `draft` | Create a draft Release |
| `quality` | Run `bun run check:web` |
| `build` | Build macOS, Windows, and Linux artifacts |
| `verify` | Check that assets exist |

Build matrix:

- macOS: arm64 and amd64.
- Windows: arm64 and amd64.
- Linux: arm64 and amd64.

The three platforms build in series. Every platform updates the same `SHA256SUMS`. Concurrent uploads overwrite each other and cause 404 responses.

The workflow creates a draft only. It does not publish the release.

## Local build

Build local artifacts only:

```sh
./scripts/release.sh build
./scripts/release.sh build -platform "darwin/arm64,darwin/amd64"
```

Or:

```sh
go tool mygo build
```

Cross-platform build:

```sh
go tool mygo build -platform "linux/amd64,linux/arm64,windows/amd64,windows/arm64"
```

Limits:

- macOS `.app` and DMG files must be built on macOS.
- The Windows installer can be built on Ubuntu with NSIS.
- Linux packages are built on Ubuntu.

Local build with update archives:

```sh
export MYGO_UPDATER_PRIVATE_KEY_FILE="$HOME/Library/Application Support/PiS/update-keys/mygo-update.key"
export PIS_UPDATE_PUBLIC_KEY="$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
export PIS_UPDATE_GITHUB="ModyQyW/pis"
./scripts/release.sh build -platform "darwin/arm64,darwin/amd64" -upload
```

## Update keys

Generate a new key pair:

```sh
./scripts/update-keygen.sh
```

Output:

- `mygo-update.key`: private key.
- `mygo-update.pub`: public key.

Set them in GitHub:

```sh
gh variable set PIS_UPDATE_PUBLIC_KEY \
  --body "$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
gh secret set MYGO_UPDATER_PRIVATE_KEY \
  --body "$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.key")"
gh variable set PIS_UPDATE_GITHUB --body "ModyQyW/pis"
```

Do not commit the private key and do not print it in a log.

## Check the draft

The script checks automatically. For a manual check:

```sh
gh release view vX.Y.Z --json isDraft,assets,publishedAt,url
gh run watch <run-id> --exit-status
```

Checklist:

- `isDraft` is `true`.
- Six architecture artifacts exist.
- `SHA256SUMS` exists.
- Six `update-*.json` manifests exist.
- No delta files are attached (`updates.deltas` is 0).
- The release notes start with the download table, and each row links to its asset. They contain no keys, internal paths, or unfinished claims.

Asset names:

```text
pis-<version>-arm64.dmg
pis-<version>-amd64.dmg
pis-setup-<version>-arm64.exe
pis-setup-<version>-amd64.exe
pis-<version>-linux-arm64.tar.gz
pis-<version>-linux-amd64.tar.gz
update-darwin-arm64.json
update-darwin-amd64.json
update-linux-arm64.json
update-linux-amd64.json
update-windows-arm64.json
update-windows-amd64.json
```

## Publish the draft

The script publishes after verification:

```sh
gh release edit vX.Y.Z \
  --title "PiS X.Y.Z" \
  --notes-file <temporary CHANGELOG section> \
  --latest \
  --draft=false
```

Check the result:

```sh
gh release view vX.Y.Z --json isDraft,publishedAt,url
gh release list --limit 1 --json tagName,isLatest
```

Requirements:

- `isDraft` is `false`.
- `isLatest` is `true`.
- `publishedAt` is not empty.

## Post-release checks

1. Install the previous public version.
2. Check for updates in the app.
3. Confirm the update target is the new version.
4. Install the update.
5. Confirm the app version.
6. Confirm that projects, sessions, settings, and extensions still load.
7. Check the Gatekeeper flow on macOS.
8. Install on Windows and Linux.

When you do not have a machine, record "skipped" and the reason. Do not use a successful build as runtime evidence.

## Failure and retry

When the workflow fails:

```sh
gh run rerun <run-id> --failed
```

The script reruns a failed job first when it sees a failed workflow.

When the publish step fails, rerun the same version:

```sh
PIS_VERSION=X.Y.Z ./scripts/release.sh
```

If the tag exists and points to `HEAD`, the script skips the commit and tag, then continues the wait and checks.

## Signing and Gatekeeper

- macOS: ad-hoc signature, not notarized.
- Windows: unsigned.
- Linux: package files and `install.sh`.

Two signatures are independent:

- The Apple code signature controls whether the app starts.
- The Ed25519 signature controls whether an update file is trusted.

Do not change the bundle ID or the update public key after a release. A bundle ID change makes the system treat the app as a new app.

## Release checklist

- Clean working tree, `main` pushed.
- `bun run check` passes.
- Version is correct.
- The English and Chinese CHANGELOG files have the version section.
- Update keys and repository variables are set.
- The tag points to the correct commit.
- The Release workflow passes.
- Six architecture artifacts exist in the draft.
- `SHA256SUMS` and the manifests are correct.
- The release is published and latest.
- The update from the previous public version passes.
- Windows and Linux runtime checks are complete, or recorded as skipped.

## Related

- [Local development](development.md)
- [Testing](testing.md)
- [Documentation site](docs-site.md)
