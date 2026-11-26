# Data, security, and privacy

PiS keeps application data separate from pi data.

PiS reads pi sessions and configuration. It does not rewrite pi credentials, models, or session files.

## Application data

macOS:

```text
~/Library/Application Support/PiS/
```

Windows and Linux use different paths. Open Settings > Diagnostics to see the actual path.

Contents:

| Item | Content |
|---|---|
| `settings.json` | Theme, palette, language, font size, notifications, approvals, trust, recent projects. See the table below |
| `window-state.json` | Window position and size |
| `extensions/` | Built-in bridge extension |

PiS also stores these values in WebView local storage:

- The draft for each session.
- The last opened session.
- The last used pi session file.

Drafts use the `pis:` prefix. They do not enter the pi session file.

## pi data

The pi data directory is usually:

```text
~/.pi/agent/
```

It contains:

- Session files in `sessions/`.
- Sign-in state in `auth.json`.
- Model configuration.
- Extensions and skills.
- Trust records.

PiS reads session files for first paint and the session list. pi remains the source of truth for model context.

PiS does not modify pi session content, credentials, models, or extension configuration. When you delete a session, PiS moves the session file to the system Trash.

## Settings file

Main fields in `settings.json`:

| Field | Purpose |
|---|---|
| `theme` | Mode: `system`, `light`, or `dark` |
| `palette` | Color palette: `amber`, `graphite`, `teal`, or `ink` |
| `language` | `en` or `zh` |
| `codeFontSize` | Code font size |
| `uiFontSize` | Interface scale |
| `sendOnEnter` | Whether Enter sends |
| `notifications` | Desktop notifications |
| `showWidgets` | Whether to show extension widgets |
| `permissions` | Approval policy and other guard settings |
| `trust` | Trust decision for each project |
| `recents` | Recent projects |
| `lastWorkspace` | Last project |
| `piPath` | Manual pi path |

PiS uses a schema version. It migrates old settings at load time. If an old file has no `sendOnEnter`, PiS keeps Enter as the send key. If it has no `palette`, PiS uses `amber`.

If settings are damaged, follow the reset steps in [Settings](/guide/settings).

## Credentials

- pi runs the sign-in.
- Credentials are in the pi directory.
- PiS does not read credential content.
- PiS does not log the sign-in terminal output.
- Diagnostics does not contain credentials.

Do not save API keys in project files. Do not paste keys into public sessions or screenshots.

## Diagnostics and logs

PiS does not write prompts or credentials to logs. It keeps the last part of pi stderr and shows it as an error message. PiS does not filter content written by pi itself.

Diagnostics contains:

- App version.
- Platform and architecture.
- Data directory.
- Settings file path.
- pi path and version.
- Settings load error.

Diagnostics does not contain session content.

## Remote content

Markdown images in a session load directly, including `http(s)` URLs.

Risks:

- A remote image reveals your IP address.
- An image URL can reach services on this computer.
- Model output or an imported session can contain an image URL.

Links open only after a click. The renderer blocks `data:` and `file:` images.

Use a container, a VM, or a restricted account when you need a strict network boundary.

## Security boundaries

PiS has three protection layers:

- Project trust: whether project-level resources load.
- Approval: whether one tool call runs.
- Plan mode: whether the current session can change files.

All three are product guards, not kernel sandboxes.

Extensions, tools, and the pi process use the permissions of the current user.

For strong isolation:

- Use a container.
- Use a VM.
- Use a restricted user.
- Use pi's own isolation features.

## Supported range

- pi `>= 1.6 < 2`.
- macOS, Windows, and Linux builds for amd64 and arm64.
- Runtime validation focuses on macOS arm64.
- Windows and Linux builds exist, but runtime validation is incomplete.

The macOS build uses an ad-hoc signature and is not notarized.
The Windows installer is not signed.
Linux uses tar, deb, rpm, and `install.sh`.

## Backup and restore

To migrate or reinstall:

1. Quit PiS.
2. Back up the PiS data directory.
3. Back up the pi data directory.
4. Install the new version.
5. Restore the files and settings you need.

Do not overwrite the whole pi data directory. Migrate only the sessions or configuration you need.

## Next

- [Settings](/guide/settings): change application settings.
- [Troubleshooting](/reference/troubleshooting): solve data and startup problems.
