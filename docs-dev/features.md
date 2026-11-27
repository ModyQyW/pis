# Feature implementation

[English](features.md) | [简体中文](features.zh.md)

This page maps each user feature to its code path, data source, and tests. Read it before you change a feature.

## Session start and resume

`Agent.Start` validates the working directory, starts `pi --mode rpc`, and waits for `get_state`.

- A new session uses a generated app id as `--session-id`.
- A resume uses `--session <path>` and still gets a new app id.
- `--approve` is added only after project trust.
- The bridge loads with `-e <bridge>`.
- `fetchState` fills the model, session file, session name, and run state.

The manager maps the app id to the process. The process owns stdin, stdout, stderr, pending calls, and the stderr tail.

`onExit` removes the session from the map and emits a `status: exited` event. Every pending call receives `pi exited`.

Tests: `internal/agent/manager_integration_test.go` (opt-in real pi), `internal/agent/coalesce_test.go`, `internal/agent/process_test.go`.

## Chat list and deletion

`Sidebar` renders open sessions and recent sessions. A chat row has a trash icon for single deletion. Select chats turns rows into checkboxes and shows a bulk delete action.

`App.tsx` opens one confirmation for all target paths. It closes each live session with `Agent.Close`, then calls `Sessions.Delete` for the file. `Sessions.Delete` moves the file to the system Trash; project files are untouched.

Tests: `frontend/src/store/chat.test.ts` covers close during start; delete uses the existing session service.

## Streaming

pi emits token deltas as `message_update` events. The Go coalescer merges them in a 16 ms window by session, type, and content index.

The frontend store keeps a `live` assistant object. `text` and `thinking` events update live blocks. `message_end` appends a full entry and clears the live object.

Edge cases:

- A non-delta event flushes pending text first.
- A tool call start and end flush text.
- Deltas with the same content index and type merge.
- The full message in `message_end` replaces the live blocks.

Tests: `internal/agent/coalesce_test.go`, `frontend/src/lib/transcript.test.ts`, `frontend/src/store/chat.test.ts`.

## Transcript

`frontend/src/lib/transcript.ts` builds display items from:

- Session entries from JSONL or the live store.
- Live assistant blocks.
- Tool runs.

It pairs tool calls with tool results by id. An orphan tool result becomes its own row. Compaction and branch summaries become separators. Extension `custom_message` entries render from top-level `content`; a legacy `{role, content}` object also works. A `background-task-notification` entry becomes a compact notice with the task name, status, error, and exit code instead of raw XML.

`SessionTranscript` uses TanStack Virtual. It renders the visible area and overscan, measures dynamic rows, and keeps the viewport pinned while the reader stays at the bottom.

Thinking rows show the assistant message `durationMs` as an approximate
duration; pi records no separate thinking timer. Intermediate text that
accompanies a tool call folds into that segment's thinking row, so the final
answer reads alone. Each message footer shows its local wall-clock time;
assistant model, token, cost, and duration metadata appear on hover. A run that
stops early shows its stop reason.

Markdown is lazy. `Markdown.tsx` configures Streamdown with code, math, CJK, and Mermaid plugins. The code font size comes from a CSS variable.

Tests: `frontend/src/lib/transcript.test.ts`.

## Tool cards

Tool data comes from two sources:

- `tool_execution_start`, `tool_execution_update`, and `tool_execution_end` events create a `runs` record.
- Tool result messages in the transcript carry the final result.

`ToolCard` shows the tool name, target, status, duration, output, diff or patch, images, and arguments. Cards start collapsed and show no output preview; expand one to see the result. Long output is clamped to a fixed height with a Show all / Show less control. A tool call with `ask_user_question` becomes a question card with the selected answers; multiple questions show one at a time with previous and next controls.

The tool target comes from common argument shapes: `command`, `path`, `pattern`, `questions`, and `description`.

Tests: `frontend/src/lib/questions.test.ts`, `frontend/src/lib/transcript.test.ts`.

## Settings

`SettingsDialog.tsx` holds the section table, search, and the general sections.
Pi configuration sections render through `PiConfigPanel` with a `section`
prop. The panel stays mounted after the first visit so edits survive a
section switch.

Search matches section labels and setting keywords in the current language
and opens the first match.

`Select` wraps Base UI Select; `Combobox` wraps Base UI Combobox with filtering
and an optional popup side rail. The provider and model defaults use
`Combobox`. The model list is scoped to one provider. When the provider is
Automatic, the model popup shows a provider rail and the reader selects one
provider to filter the list.

Native selects and checkboxes are not used. `Checkbox` wraps Base UI Checkbox
and is disabled explicitly inside busy fieldsets.

## Composer

`Composer.tsx` handles text, drafts, attachments, file search, commands, and the model picker entry point.

- Drafts save per session under the `pis:draft:` key. A failed send restores the draft and attachments.
- `@` search calls `Files.Search`. The Go service caches the file list and ranks paths by basename and path score.
- `/` lists commands from `get_commands`.
- Images up to 10 MB and text files up to 512 KB become attachments.
- The send key comes from `settings.sendOnEnter`.
- While a session streams, a new prompt uses `streamingBehavior: "steer"`.
- Clicking the context percentage opens a panel with the exact used and total token counts, an estimated split by system prompt, tools, skills, project context, and messages, the free space, and a Compact context action. `sessions.Read` reconstructs the current system prompt from system-message patches and the latest compaction snapshot; category values use pi's character-based estimate and are labeled as estimates.

Tests: `frontend/src/store/chat.test.ts`, `internal/files/files_test.go`, `internal/sessions/sessions_test.go`.

## Trust

`internal/trust/Inspect` builds the resource list.

- It checks `.pi` resources in the workspace root.
- It checks `.agents/skills` in the workspace and every ancestor.
- It excludes the user's own `~/.agents/skills`.
- It reads the saved PiS decision, then the nearest pi `trust.json` record.
- An undecided project shows the trust dialog.

A trusted project starts pi with `--approve`. PiS never writes the pi trust file.

Tests: `internal/trust/trust_test.go`.

## Approvals and plan mode

`internal/bridge/bridge.ts` runs inside pi.

- The `tool_call` handler checks the policy and the tool input.
- Smart checks destructive shell, sensitive files, outside-workspace paths, and change tools.
- A session grant key is `tool + command or path`.
- A denied call returns `{ block: true, reason }`.
- Plan mode limits the active tool set, injects instructions, and blocks change tools and common mutating shell commands.
- Plan state is stored in a `pis-plan` entry and restored on session start.

Tests: `internal/bridge/bridge.test.ts`.

## Changes, files, and Git

`internal/gitx` reads Git state with fixed timeouts.

- `Status` parses `status --porcelain=v1 -z` and `diff --numstat -z`.
- A rename uses the new path for its stat.
- `Diff` returns the `HEAD` diff or a full addition for an untracked file.
- `Revert` uses `git restore --source=HEAD --staged --worktree`.
- Worktree list, add, and remove wrap `git worktree`.

`internal/files` lists Git files or walks the workspace, caches the list for 20 seconds, and previews files with a size limit. Preview and untracked diff resolve symlinks and check the workspace boundary.

Tests: `internal/gitx/integration_test.go`, `internal/files/files_test.go`.

## Pi configuration

`internal/piconf` reads pi's user configuration and lists it in the Pi configuration dialog.

- `Inspect` reads `settings.json` defaults and resources, `models.json` providers (including JSONC comments and trailing commas), discovered skill folders, extension folders that pi would load, package sources, and merged MCP servers. User MCP servers are read without a workspace; project servers carry the trust state.
- Before trust, project-configured paths are listed without reading them. After trust, discovered project resources are listed with the active state; project defaults are reported separately so the user defaults stay editable.
- A fingerprint of the user-level configuration drives the confirmation banner.
- `Models` runs `pi --list-models` and parses the provider and model columns for the default-model picker.
- `SetDefaults`, `SaveProvider`, `RemoveProvider`, `AddPath`, `RemovePath`, `AddPackage`, and `RemovePackage` write pi's `settings.json` or `models.json` atomically. Settings writes take pi's `settings.json.lock`; unknown fields, legacy `skills` object fields, and per-model fields are preserved.
- `Inspect` returns only `apiKeySet` and `apiKeyEnv`; a stored key never reaches the page. A saved key goes to `models.json`, and the input stays blank on the next edit.
- Package declarations are written, not installed. pi installs them at session start.

Tests: `internal/piconf/piconf_test.go`.

## MCP

`internal/mcp` reads the user and project `mcp.json` files.

- `List` merges user and project entries. A project entry can override only `enabled`, `exposure`, and `toolExposure`.
- `Add` rejects an existing name and writes a simple entry.
- `SetEnabled` changes only the `enabled` field of the selected file.
- `Remove` deletes the entry from the selected file.
- `writeConfig` keeps unknown top-level keys and writes atomically.

Tests: `internal/mcp/mcp_test.go`.

## Extensions and dialogs

pi sends `extension_ui_request` records. Go forwards them as `extension-ui` events without passing them through the event reducer.

The frontend handles:

- `notify`: toast.
- `setStatus`: status rail.
- `setWidget`: widget area when the setting is on.
- `setTitle`: stored, not displayed.
- `set_editor_text`: composer text.
- `select`, `confirm`, `input`, `editor`: inline dialog dock.

Dialog responses go back with `Agent.RespondUI`. A dialog with a timeout is dismissed in the UI when the timeout expires. Events for a closed session are dropped.

Tests: `frontend/src/store/chat.test.ts`.

## Session search and command palette

`internal/sessions.Search` scans recent sessions and the active branch.

- It matches the title first.
- It reads at most 2 MB per session for a query.
- Summary reads cache by path, cwd, mtime, and size.
- `List` filters a shared session directory by the header cwd.

`CommandPalette` debounces queries by 180 ms and merges command actions with session hits.

Tests: `internal/sessions/sessions_test.go`.

## Settings and interface language

`internal/settings` stores a versioned JSON file.

- `merge` fills missing values and migrates old files.
- Version 2 adds `sendOnEnter`; a version 1 file keeps Enter as the send key.
- `SetPreferences` validates ranges and language values.
- `App.tsx` applies `--code-font-size` and `--ui-scale` before paint.
- Code surfaces use `--code-font-size`; the body uses `--ui-scale`.
- The Settings dialog has General and Pi configuration tabs. The Pi tab renders `PiConfigPanel`; the launch review renders the same panel in `PiConfigDialog`.

The frontend dictionary is in `frontend/src/lib/i18n.ts`. `t()` is called during render. Missing keys fall back to the English source.

Tests: `internal/settings/settings_test.go`, `frontend/src/lib/i18n.test.ts`.

## Updates and release

The mygo updater window uses GitHub Releases. `scripts/release.sh` prepares the version, CHANGELOG, tag, release workflow, asset verification, and publication.

Release notes are the matching CHANGELOG section. The script extracts it to a temporary file for `gh release edit`.

See [Build, sign, and release](release.md).

## Where to add tests

Add a test when a change touches:

- Session parsing, limits, or cache behavior.
- Tool result pairing or transcript rendering.
- Approval, trust, or plan rules.
- File or path boundaries.
- MCP merge or write behavior.
- Store state that can lose user input or leak a process.
- Settings migration or validation.

See [Testing](testing.md) for commands and layers.
