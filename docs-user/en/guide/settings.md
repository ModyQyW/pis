# Settings

PiS stores settings in its application data directory. Changes apply immediately and remain after a restart.

Open Settings:

1. Click Settings at the bottom of the sidebar.
2. Or press `⌘,` (`Ctrl+,` on Windows and Linux).

![Settings panel](/images/settings.png)

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

Desktop notifications controls system notifications when a background run finishes.

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

## Providers

Sign in to a provider… opens the pi sign-in terminal.

MCP servers… opens the MCP configuration dialog.

PiS uses the pi credential store. It does not save API keys and does not log the sign-in terminal output.

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

PiS does not copy or rewrite pi sessions, credentials, models, or extension configuration.

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
