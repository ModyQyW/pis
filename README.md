English | [简体中文](README.zh.md)

<p align="center"><img src="resources/icon.png" alt="PiS icon" width="120" height="120"></p>

Default mark uses a white background. The black-background variant is
[`resources/icon-dark.png`](resources/icon-dark.png).

# PiS

A desktop coding agent built on [mygo](https://mygo.run) with
[pi](https://pi.dev) as the engine. The S stands for strong.

![PiS empty state](docs-user/public/images/empty.png)

PiS is a small native shell around a rich web UI. It runs your installed
pi over RPC, so your existing models, credentials, sessions, skills, prompt
templates, packages, and extensions are the ones it uses. It does not bundle
pi, replace pi's data, or install a second agent runtime.

## Status (2026-11-24)

V1 is implemented and packaged for macOS arm64 validation; the release workflow
builds macOS, Windows, and Linux artifacts for both amd64 and arm64. Core sessions,
streaming Markdown, extensions, approvals, plan mode, changes, MCP
configuration, worktrees, session search, and the desktop shell work.
Current public release: **[0.0.5](https://github.com/ModyQyW/pis/releases/tag/v0.0.5)**
(arm64 DMG 7.2 MB). The update feed resolves to `0.0.5`. The `0.0.3`
GitHub release is a draft. It is not public and does not serve updates. The
release and update feed are public. macOS is ad-hoc signed, so Gatekeeper
requires a one-time approval. English is the default. Chinese is available in
Settings. See [`docs-dev/testing.md`](docs-dev/testing.md) for evidence and
[`docs-dev/history.md`](docs-dev/history.md) for the project history.

## What works

- **Real pi sessions**: start, resume, rename, fork, clone, tree navigation,
  export HTML, delete to Trash, and multiple concurrent sessions.
- **Streaming chat**: Streamdown Markdown with GFM tables, Shiki code, KaTeX
  math, Mermaid diagrams, CJK line breaking, thinking blocks, images, tool cards,
  live shell output, diffs, compaction, retries, usage and cost.
- **Tool cards** for `bash`, `read`, `edit`, `write`, `grep`, `find`, `ls`,
  `todo`, `ask_user_question`, subagents, and any extension tool (generic card).
- **Composer**: `@file` search, pi slash commands, image paste/drop, text
  attachments, per-session drafts, model and thinking pickers, and Settings
  controls for code/interface size and Enter-to-send.
- **Extensions**: existing pi extensions load unchanged; RPC dialogs appear in
  an inline dock; statuses and widgets are shown quietly; extension errors are
  visible. Shipped bridge adds tree navigation, plan mode, and optional smart
  approvals under `pis-*` names only.
- **Project trust**: explicit dialog before project-local pi resources load;
  pi's own trust store is read, never written.
- **Approvals**: optional Smart / Ask all / Allow all policy, once/session
  grants, no auto-deny. When another guard such as `cc-safety-net` is detected,
  PiS's guard stays off unless enabled in Settings.
- **Plan mode**: read-only exploration and a plan; common mutating tools and
  shell commands are blocked until you turn it off. It is a workflow guardrail,
  not a sandbox.
- **Changes and files**: Git branch/status, per-file unified diff, copy patch,
  per-file revert-to-HEAD with confirmation, reveal, file list and read-only
  preview.
- **MCP and worktrees**: manage user/project MCP entries (add, enable, remove;
  advanced fields stay in `mcp.json`), and list/create/open/remove Git
  worktrees. Removal refuses a worktree with uncommitted files; forcing asks a
  second time.
- **Session search and plans**: full-text search across session branches from
  the command palette; Plan and Agents tabs read pi's todo state and subagent
  activity; `ask_user_question` renders as an inline card with the selected
  answer.
- **Notifications and language**: native completion notifications when a
  background run finishes, a Settings test button, and an English/Chinese UI
  switch.
- **Release plumbing**: GitHub CI for Go/frontend/cross-build/package,
  versioned release workflow, optional signing/notarization, and the mygo
  updater window. Updates use the public GitHub Releases feed.
- **Providers**: in-app pty terminal running `pi auth login`; no credential
  storage or logging by the app.
- **Native shell**: hidden inset title bar, native menus, macOS appearance,
  quit guard for running sessions, single small binary.

More screenshots: [chat](docs-user/public/images/chat.png),
[approval](docs-user/public/images/approval.png),
[plan mode](docs-user/public/images/plan.png),
[trust](docs-user/public/images/trust.png),
[session tree](docs-user/public/images/session-tree.png),
[diff](docs-user/public/images/diff.png),
[login](docs-user/public/images/login.png),
[MCP](docs-user/public/images/mcp.png),
[worktrees](docs-user/public/images/worktrees.png),
[Chinese shell](docs-user/public/images/zh-chat.png),
[Chinese settings](docs-user/public/images/zh-settings.png).

## Requirements

- macOS (arm64 verified; Windows/Linux builds are produced but runtime-untested).
- Go 1.27.3+ and Bun for building.
- pi **>= 1.6 < 2** installed and authenticated. PiS finds it in Settings,
  `PIS_PI`, `PATH`, common install locations, then your login shell.
  Use `pi auth login` (also available in the app) to connect a provider.

Pi is not bundled. The arm64 DMG is 7.2 MB; pi itself is a separate install.

## Run from source

```sh
bun install
bun run dev        # mygo dev: app window + Vite live reload
```

Useful environment variables during development:

| Variable | Purpose |
|---|---|
| `PIS_PI` | explicit pi executable |
| `PIS_OPEN` | open a workspace on launch |
| `PIS_OPEN_SESSION` | open a session file on launch |
| `PIS_DEV_PROMPT` | send a prompt after the deep-linked session opens |
| `PIS_GUARD_OVERRIDE` | force `off`, `smart`, `ask`, or `allow` for a test |

## Build

```sh
bun run build
open "build/darwin-arm64/PiS.app"
```

Release builds are ad-hoc signed and not notarized; macOS may require
System Settings → Privacy & Security → Open Anyway. Published artifacts are on
[GitHub Releases](https://github.com/ModyQyW/pis/releases).

## Verify

Before committing, format and run the full gate:

```sh
bun run format
./scripts/check.sh
```

`bun run format` only formats: `go fmt` on module packages and Vite+'s `vp fmt`.
`./scripts/check.sh` runs Go formatting/build/vet/tests, Vite+ format/lint/
typecheck, bridge and frontend tests, the frontend build, and the docs-user
build. `bun run check` is the same gate. `bun install` installs a Vite+
pre-commit hook that runs `./scripts/check.sh`. Vite+ is a project dependency;
no global `vp` install is required. A real-pi integration
test is opt-in:

```sh
PIS_INTEGRATION=1 go test ./internal/agent -run TestStartAndInspectRealPi
```

## Architecture

```
mygo window (Go, system webview)
  ├─ typed IPC services: Desktop, Agent, Sessions, Files, Git, Auth
  ├─ one `pi --mode rpc` process per open session
  ├─ fast session JSONL reader for first paint
  ├─ bundled `pis-bridge` pi extension (tree nav, plan, approvals)
  └─ React 19 frontend (Vite, Tailwind, Base UI/shadcn,
     Streamdown code/Mermaid plugins, TanStack Virtual)
```

Decisions and tradeoffs are in [`docs-dev/decisions.md`](docs-dev/decisions.md).
The current architecture is in [`docs-dev/architecture.md`](docs-dev/architecture.md).
The research that led there, including competitor strengths and measured
prototypes, is in [`docs-dev/research.md`](docs-dev/research.md).

## Known limits

- macOS arm64 is runtime-validated; Windows/Linux artifacts build but have not had runtime QA.
- The app requires an installed compatible pi. There is no bundled/auto-installer.
- RPC supports extension dialogs, statuses, and widgets, but not
  `ctx.ui.custom()` TUI components or custom editors/themes. Some extensions
  degrade or offer text fallbacks; PiS does not fake them.
- Auto-update uses GitHub Releases and an Ed25519 update key. The signed
  0.0.1 → 0.0.2 update was verified. The public `0.0.4` manifest and
  `0.0.2 → 0.0.4` delta were verified. The installed-app update path was not
  run. The `0.0.3` release is a draft. macOS builds are ad-hoc signed, not
  notarized; Gatekeeper requires a one-time Open Anyway approval.
- Extension dialogs and generic tool cards remain the fallback for custom
  extension UIs; native menu labels stay English in Chinese mode.
- Markdown images from remote URLs load automatically, so model output or an
  imported session can cause network requests. Links still open only after a
  click. See ADR-019 in [`docs-dev/decisions.md`](docs-dev/decisions.md).
- Smart approvals and plan mode are heuristics, not a sandbox. Use the OS, a
  container, or pi's own isolation when you need a real boundary.

## Documentation

- **User guide:** [`docs-user/en/`](docs-user/en/) and
  [`docs-user/zh/`](docs-user/zh/), built with
  [Rspress](https://rspress.rs/) and published at
  <https://pis.modyqyw.top>. It covers installation, the window, projects,
  sessions, the composer, changes, approvals, models, MCP, worktrees,
  extensions, settings, and troubleshooting in English and Chinese.
- **Developer docs:** [`docs-dev/`](docs-dev/), starting with
  [`docs-dev/README.md`](docs-dev/README.md). It covers research, architecture,
  feature implementation, UX, development, testing, release, the docs site,
  decisions, pitfalls, and the project history. Main guides have English and
  Chinese versions.
- **Changelog:** [`CHANGELOG.md`](CHANGELOG.md) and
  [`CHANGELOG.zh.md`](CHANGELOG.zh.md).

The Rspress source lives in `docs-user/`; the build output is
`docs-user-build/` and is not committed.

```sh
bun run docs:dev
bun run docs:build
bun run docs:preview
```

The user guide is deployed with Cloudflare Pages at
<https://pis.modyqyw.top>. Deployment steps are in
[`docs-dev/docs-site.md`](docs-dev/docs-site.md).

## License

MIT. The icon includes a silhouette adapted from Noto Emoji; see
[`NOTICE.md`](NOTICE.md) and [`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt).
