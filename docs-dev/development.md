# Local development

[English](development.md) | [简体中文](development.zh.md)

## Environment

- Go 1.27.3 or newer.
- Bun 1.4.5.
- A working pi for real session tests.
- macOS is the main development and runtime validation platform.

```sh
git clone https://github.com/ModyQyW/pis.git
cd pis
bun install
```

`bun install` installs the Vite+ pre-commit hook. The hook runs `./scripts/check.sh` on commit.

Vite+ is a project dependency. Do not install `vp` globally.

## Start the app

```sh
bun run dev
```

`mygo dev` starts the app window and Vite hot reload.

To debug only the Web UI:

```sh
bun run dev:web
```

Open `http://localhost:5173`. Browser mode uses mock data and a mock chat stream. It does not connect to pi.

## Commands

| Command | Purpose |
|---|---|
| `bun run dev` | App window and hot reload |
| `bun run dev:web` | Vite only |
| `bun run format` | `go fmt` and Vite+ formatting |
| `bun run check` | Full check gate |
| `bun run check:web` | Vite+ formatting, lint, and type checks |
| `bun run test` | Frontend Vitest |
| `bun run test:bridge` | bridge Bun tests |
| `bun run build` | Build the local app |
| `bun run build:web` | Build the frontend only |
| `bun run generate` | Generate `frontend/src/mygo.ts` |
| `bun run docs:dev` | Start the user documentation site |
| `bun run docs:build` | Build the user documentation site |
| `bun run docs:preview` | Preview the user documentation site |

The full gate `scripts/check.sh` runs:

1. Go format check on Git-tracked Go files.
2. Go build, vet, and test, excluding Go packages in `node_modules`.
3. Vite+ format, lint, and type checks.
4. bridge Bun tests.
5. Frontend Vitest.
6. Production frontend build.
7. User documentation build in English and Chinese.

Before a commit:

```sh
bun run format
bun run check
```

Do not bypass a failed format, lint, type, or test check.

## Development environment variables

These variables are for development and debugging:

| Variable | Purpose |
|---|---|
| `PIS_PI` | Explicit pi executable. Also works in normal startup |
| `PIS_OPEN` | Open a project at startup in development mode |
| `PIS_OPEN_SESSION` | Open a session file at startup in development mode |
| `PIS_DEV_PROMPT` | Send a prompt after the deep-linked session opens |
| `PIS_GUARD_OVERRIDE` | Force the approval policy: `off`, `smart`, `ask`, or `allow` |
| `PIS_INTEGRATION` | Set to `1` to run the real pi integration test |

Except for `PIS_PI` and the test variable, these variables work only in development mode. Do not put them in the user guide.

## Change a Go service

Exported Go methods are bound to the page.

To add a method:

1. Add an exported method to the service struct.
2. Run `bun run generate`.
3. Add the wrapper you need in `frontend/src/lib/api.ts`.
4. Run the type check and tests.

Rules:

- Every exported method becomes an IPC method that the renderer can call.
- Do not export a method for tests or internal use.
- Validate parameters from the page as untrusted input.
- Check workspace boundaries and symlinks for path parameters.
- Add context to errors. Do not return a zero value silently.
- Check the workspace boundary and symlinks for path parameters.

`frontend/src/mygo.ts` is generated. Do not edit it by hand.

## Change settings

The settings structure is in `internal/settings/settings.go`.

To add a user setting:

1. Add a field to `Settings`.
2. Add the default in `Defaults`.
3. Add validation or migration in `merge`.
4. Add a nullable field to `app.Preferences`.
5. Apply the field in `SetPreferences`.
6. Add a control in `frontend/src/components/SettingsDialog.tsx`.
7. If the setting changes style, apply a CSS variable or attribute in `App.tsx`.
8. Run `bun run generate`.
9. Add load and migration tests.

Define the default when the field is missing. When a boolean cannot tell "unset" from `false`, use a schema version migration.

The current version is `settings.Version`. Version 1 files have no `sendOnEnter`; PiS keeps it `true` when they load.

## Change the bridge

The bridge source is in `internal/bridge/bridge.ts`.

1. Change the source.
2. Increase `Version` in `internal/bridge/bridge.go`.
3. Run the bridge tests.
4. Test the commands with real pi.

`Ensure` writes a new file and deletes old `pis-bridge-*` files. If the version does not change, an old file can be reused.

The bridge registers only `pis-*` names. Do not register a common tool or command name.

## Change the frontend API

`frontend/src/lib/api.ts` is the wrapper between the page and IPC.

- Browser mode uses mock data.
- Mock data must load only in development builds.
- Guard every mock branch with `import.meta.env.DEV` or `MOCK`.
- A production build must not contain mock data.

Use `t()` for user-visible text. Add the Chinese key in `frontend/src/lib/i18n.ts`. Do not call `t()` at module scope. Call it during render.

## Debug

### Browser UI

`bun run dev:web` is for layout, style, and state debugging. Mock data covers:

- Projects, sessions, and files.
- Chat streaming, code blocks, Mermaid, and math.
- Approval, trust, MCP, worktree, and sign-in dialogs.
- Settings changes, including font size and send key.

Mock data does not send real model requests.

### Real pi

`bun run dev` uses real pi. During a test:

- The pi version must be between `1.6` and `2`.
- Sessions write to the pi data directory.
- Tool calls execute for real.
- Test projects must not contain important data.

### Real pi integration test

```sh
PIS_INTEGRATION=1 go test ./internal/agent -run TestStartAndInspectRealPi
```

The test starts pi, reads state and commands, then closes the session. It sends no prompt. See [Testing](testing.md).

### Logs and errors

- App startup errors go to stderr.
- When the pi process crashes, the interface shows the last stderr lines.
- Diagnostics contains paths and versions, not prompts or credentials.
- Do not print prompts, credentials, or full session content in code.

## Code rules

- Do not fake tool results, approval results, or session state.
- Do not swallow errors. Add context, and deliver the error to the user or an error handler.
- pi session, credential, model, and trust files are read-only. User actions are the exception: delete a session, write `mcp.json`.
- Resolve symlinks in new path checks.
- Set byte limits in new session file reads.
- Use virtualization or a size limit in new lists.
- Implement the UI for a new setting, or delete the setting.
- Delete bindings and generated files with the code.
- Documentation: user pages cover user behavior; developer pages cover design and evidence.

## Build the local app

```sh
bun run build
open "build/darwin-arm64/PiS.app"
```

A local build uses an ad-hoc signature. Gatekeeper can ask on the first open.

Cross-platform builds, signing, update keys, and release steps are in [Build, sign, and release](release.md).

## Related

- [Architecture and data flow](architecture.md)
- [Feature implementation](features.md)
- [Testing](testing.md)
- [Pitfalls](pitfalls.md)
- [Decisions](decisions.md)
