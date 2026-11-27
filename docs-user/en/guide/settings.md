# Settings

PiS stores settings in its application data directory. Changes apply immediately and remain after a restart.

Open Settings:

1. Click Settings at the bottom of the sidebar.
2. Or press `⌘,` (`Ctrl+,` on Windows and Linux).

![Settings panel](/images/settings.png)

The dialog has a section list on the left. Click a section to show only that
section. The search field filters sections by their titles and settings. The
first match opens at once, so you do not need to switch sections or scroll
through the whole dialog.

## Appearance

The theme mode has three choices:

- System: follow the operating system.
- Light.
- Dark.

### Palette

Four palettes are available:

- Amber (default): warm neutral surfaces with an amber accent.
- Graphite: cool neutral surfaces with a steel blue accent.
- Teal: cool neutral surfaces with a deep teal accent.
- Ink: neutral gray surfaces with a near-black accent.

A palette applies to both light and dark mode. It changes surfaces, the brand accent, and focus rings; layout and text sizes stay the same. Primary actions stay near-black in every palette.

![Palette picker](/images/palettes.png)

Existing settings keep Amber after an upgrade. If an older settings file has no palette, PiS also uses Amber. The palette is saved in `settings.json` as `palette` with the values `amber`, `graphite`, `teal`, or `ink`.

The interface supports English and Chinese. After a language change, the interface text updates. Native menus stay in English.

Chinese interface example:

![Chinese settings panel](/images/zh-settings.png)

Show raw extension widgets controls extension widgets.

- The default is off.
- When it is on, an expandable widget area appears above the composer.
- Widgets use a terminal layout and can take a lot of space.

## Notifications

Notifications controls system notifications when a background run finishes.

- The Test notification button checks permission.
- The switch has no effect when the system does not allow notifications.
- PiS sends a completion notification only when PiS is not in the foreground.

## Text and input

Code font size affects:

- Markdown code blocks.
- The diff dialog.
- Tool output.
- File previews.
- The sign-in terminal.

The default is 13 px. The selectable range is 10 px to 20 px.

Interface size scales the whole window, including dialogs. The default is 100%.

Send on Enter controls the send key.

- On: Enter sends, and Shift+Enter adds a new line.
- Off: Enter adds a new line, and `⌘Enter` (`Ctrl+Enter` on Windows and Linux) sends.

The composer shows the current key hint at the bottom right.

## Pi configuration

Open Settings, then select a Pi configuration section in the left list. The
sections are Defaults, Models and providers, Skills, Extensions, and MCP
servers. They read pi's own files and show:

- Default provider, model, and thinking level.
- Custom providers and models from `models.json`.
- Skills that pi discovers and the paths configured in `settings.json`.
- Extension files, configured paths, and package sources.
- MCP servers from `mcp.json`.

The Defaults section shows the pi agent directory and the full paths of
`settings.json`, `models.json`, and `mcp.json`. It also shows the project
`.pi` paths when a project is open. Reveal pi config folder selects that
directory in the file manager.

The default provider and model fields are searchable. Open the dropdown and
type; the current label is selected, so typing replaces it and filters the
list. The model list shows only the
selected provider. When the provider is Automatic, the model popup has a
provider list on the left; select a provider there to filter the models.

Sign in in Models and providers selects a provider from the list that pi
reports. PiS runs pi's own sign-in and does not store or log the credentials.
See [Models and sign-in](/guide/models).

The Skills section puts Add skill path above the list and filters the list as
you type. The skills.sh link opens the public skills directory. The Extensions
section puts the path and package forms above their lists. The MCP servers
section links to pi's MCP documentation.

Changes write pi's files directly. PiS writes pi's `settings.json` and
`models.json` only when you save, and it preserves fields it does not edit.
The Open MCP servers button in the MCP servers section opens the MCP dialog; see
[MCP servers](/guide/mcp). If a trusted project sets its own startup model,
the Defaults section shows a note; the project value wins for new sessions in that project.

When pi's configuration changed since your last confirmation, a separate Pi
configuration dialog opens at launch. Review the list and click Use this
configuration.

PiS does not write pi's `auth.json`, `trust.json`, or session files.

## pi executable

PiS needs the pi executable.

Automatic search order:

1. The path in Settings.
2. `PATH`.
3. Common install locations:
   - `$BUN_INSTALL/bin/pi`, default `~/.bun/bin/pi`
   - Homebrew directories
   - npm, pnpm, and Volta global directories
4. The login shell `PATH`.

When you start PiS from Finder or a desktop launcher, PiS reads the login shell `PATH`. This lets a pi script installed by bun or npm find node.

Actions:

- Enter an absolute path, then click Use path. The path becomes the only source.
- Click Check to run detection again.
- Clear the input, then click Use path to return to automatic detection.

The status line shows the version and path. The version must be `pi >= 1.6 < 2`.

When the path does not run, PiS shows the error for that path and does not switch to another installation.

## Approvals

There are three approval policies: Smart, Ask all, and Allow all.

Use PiS approvals controls built-in approvals:

- When it is on, PiS forces built-in approvals on.
- When it is off, PiS turns built-in approvals off. This is useful when you use another guard.
- When another guard is present, built-in approvals are off by default.

Allow all also turns off built-in approvals.

See [Trust, approvals, and plan mode](/guide/approvals).

## Updates

Check for updates… checks for a new version now.

PiS checks once a day in the background by default.

Updates come from public GitHub Releases. An Ed25519 key signs the update archives.

The macOS build uses an ad-hoc signature. Gatekeeper can ask again after an update.

## Diagnostics

Diagnostics shows:

- App version.
- Platform and architecture.
- Data directory.
- Settings file path.
- pi path and version.
- Settings load error, if any.

Diagnostics does not contain prompts, credentials, or session content.

Buttons:

- Copy report: copy the diagnostic text to the clipboard.
- Reveal data folder: open the PiS application data directory.

Check the report for private paths before you send it.

## Data directory

macOS:

```text
~/Library/Application Support/PiS/
```

Contents:

```text
settings.json           PiS settings
window-state.json       window position and size
extensions/             built-in bridge extension
```

For other systems, use the path in Diagnostics.

pi data is in the pi directory:

```text
~/.pi/agent/
```

PiS does not copy pi's sessions or credentials. It writes pi's `settings.json`, `models.json`, and `mcp.json` only when you save a change in the app.

PiS local state also includes:

- Drafts and the last session with the `pis:` prefix.
- These values are in WebView local storage.

## Reset settings

If settings are damaged:

1. Quit PiS.
2. Find the data directory.
3. Move the whole directory to a backup location.
4. Start PiS again.

PiS creates new default settings.

Do not delete `~/.pi/agent`. Deleting it removes pi sessions and sign-in state.

## Next

- [Keyboard shortcuts](/guide/shortcuts): see all shortcuts.
- [Data, security, and privacy](/reference/data): learn where data is stored.
- [Troubleshooting](/reference/troubleshooting): solve settings and update problems.
