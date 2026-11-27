# Install and first run

PiS is a desktop window, not a complete agent. You must install pi and sign in once before you use PiS.

## Requirements

- A macOS, Windows 10/11, or common Linux desktop computer.
- **pi >= 1.6 < 2** installed.
- At least one provider signed in.

Check pi:

```sh
pi --version
```

If the version is older than 1.6, or 2.0 or newer, PiS shows a warning and does not start a session. Upgrade pi in the terminal, then check again in PiS.

Check sign-in:

```sh
pi auth login
```

`pi auth login` is pi's own sign-in command. PiS does not store credentials. You can sign in from a terminal or from PiS. See [Models and sign-in](/guide/models).

## Download

Open [GitHub Releases](https://github.com/ModyQyW/pis/releases), then download the file for your system:

| System | File |
|---|---|
| macOS | `.dmg` |
| Windows | `pis-setup-<version>-<arch>.exe` |
| Linux | `.tar.gz`, `.deb`, or `.rpm` |

Use `arm64` for Apple Silicon, and `amd64` for Intel.

## Install on macOS

1. Open the `.dmg` file.
2. Drag `PiS.app` to the Applications folder.
3. Open `PiS.app`.

The macOS build uses an ad-hoc signature. It is not notarized. Gatekeeper can block the first launch.

If macOS says it cannot check the app:

1. Open System Settings.
2. Open Privacy & Security.
3. Find PiS at the bottom of the page, then click Open Anyway.
4. Open PiS again and confirm.

You can also remove the quarantine flag in a terminal:

```sh
xattr -dr com.apple.quarantine "/Applications/PiS.app"
```

Do this only for a file from this repository's Releases. Do not remove the quarantine flag from an app with an unknown source.

## Install on Windows

1. Run the installer.
2. If SmartScreen says "Unknown publisher", click More info.
3. Click Run anyway.
4. Finish the installation and start PiS.

The Windows installer is not code-signed. Confirm the file comes from this repository's Releases before you install it.

## Install on Linux

Use your package manager for a `.deb` or `.rpm` file. Or extract the `.tar.gz` file.

The `.tar.gz` file includes `install.sh`. Run it to add PiS to the desktop menu and add a `pis` command:

```sh
chmod +x install.sh
./install.sh
```

You can also run the extracted program directly:

```sh
chmod +x pis
./pis
```

## First launch

PiS opens on an empty page.

![PiS empty page](/images/empty.png)

The empty page shows the current project and recent sessions. Open a project first.

### 1. Open a project

Click Open a project folder in the sidebar, or press `⌘O` (`Ctrl+O` on Windows and Linux).

Select the project root, for example the root of a code repository. PiS adds the project to the recent list.

### 2. Handle project trust

If the project contains project-level pi resources, PiS shows a trust dialog.

![Project trust dialog](/images/trust.png)

The dialog lists the detected resources, for example:

- `.pi/settings.json`
- `.pi/extensions`
- `.pi/skills`
- `.agents/skills`

Select Trust project to let pi load these resources. Select Don't trust to let pi skip them. PiS stores the decision in its own settings. It does not write to pi's trust file.

Trust only a project you have checked. Extensions can run code with the same system permissions as pi.

### 3. Check the pi path

Open Settings, then find pi executable.

![pi path in Settings](/images/settings-path.png)

PiS finds pi automatically. The search order is:

1. The path in Settings.
2. `PATH`.
3. Common install locations, for example `~/.bun/bin/pi`, Homebrew, npm, pnpm, and Volta.
4. The login shell `PATH`.

If PiS cannot find pi, or the version is not compatible, the Settings page shows the reason.

You can also enter the absolute path of pi, then click Use path. PiS then uses only that path. If the path does not run, PiS does not switch to another installation.

### 4. Review pi's configuration

When pi's configuration differs from the last confirmation, the Pi
configuration dialog opens.

It lists the default model, custom providers, skills, extensions, packages,
and MCP servers that pi will load. Click Use this configuration, or change an
item first. See [Settings](/guide/settings) and [Models and sign-in](/guide/models).

PiS writes pi's files only when you save in this dialog. It never writes
pi's credentials or trust file.

### 5. Sign in to a provider

If no model is available, the chat area shows a prompt.

![Provider sign-in](/images/login.png)

Click Connect a provider, or open "Sign in to a provider…" in Settings. PiS runs:

```sh
pi auth login <provider>
```

The sign-in runs in the terminal inside the app. You can use account sign-in or an API key.

pi stores the credentials. PiS does not log the terminal output, and it does not write credentials to diagnostics.

### 6. Send the first message

Describe the goal in the composer, then press Enter.

Good first messages:

- "Explain the entry points and data flow of this project."
- "Find a real bug, explain the cause, and fix it."
- "Review the current uncommitted changes."

pi selects the tools. Tool calls appear as cards. The answer streams into the transcript.

## First check

Run these checks after installation:

1. The sidebar shows projects and sessions.
2. A short message returns a streaming answer.
3. A tool card expands and shows output.
4. Settings shows a compatible pi version.
5. Pi resources lists the skills, providers, and packages from pi.
6. The light and dark themes switch.
7. Closing a running session shows the quit guard.

## Next

- [Window and interface](/guide/interface): learn the parts of the window.
- [Projects](/guide/projects): open and switch projects.
- [Sessions](/guide/sessions): create and manage sessions.
- [Models and sign-in](/guide/models): switch models and manage providers.
