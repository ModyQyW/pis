# Troubleshooting

Check pi first. Most problems come from a missing pi, an incompatible version, or a missing sign-in.

## pi not found

In a terminal, run:

```sh
which pi
pi --version
```

On Windows, use `where pi` instead of `which pi`.

Then check pi executable in PiS Settings.

A GUI app can have a different `PATH` from a terminal. The safest fix is to enter the absolute path of pi, then click Use path.

Common paths:

```text
~/.bun/bin/pi
/opt/homebrew/bin/pi
/usr/local/bin/pi
```

## Unsupported pi version

PiS supports `pi >= 1.6 < 2`.

To upgrade, use the pi install method. For example, run the original install command again, or use a package manager.

After the upgrade, click Check in Settings.

## macOS cannot open the app

The current build uses an ad-hoc signature.

Steps:

1. Open System Settings.
2. Open Privacy & Security.
3. Find PiS, then click Open Anyway.

You can also run:

```sh
xattr -dr com.apple.quarantine "/Applications/PiS.app"
```

Do this only for a file from this repository's Releases.

## Windows says unknown publisher

The current installer is not code-signed.

1. Click More info.
2. Click Run anyway.
3. Finish the installation.

Confirm the download source and checksum. When a security policy blocks unsigned programs, use a signed build or build PiS yourself.

## Sign-in fails

Check:

- The provider ID.
- Network access to the provider.
- Another sign-in terminal is already open.
- The terminal shows a specific error.

Only one sign-in terminal can be open at a time. Close the old window and try again.

pi runs the sign-in. PiS does not store credentials and does not change the sign-in result.

If the sign-in terminal does not respond:

1. Close the sign-in window.
2. Open Sign in to a provider again.
3. Start the sign-in again.

## No models available

When the chat area shows "No models are available":

1. Click Connect and complete provider sign-in.
2. Open the model picker.
3. Click the refresh button.

If models are still missing, check pi model configuration and sign-in state. See the [pi model documentation](https://pi.dev/docs/latest/models).

## Project extensions or skills do not load

The project is usually not trusted.

1. Check the `.pi` resources in the project root.
2. Check `.agents/skills` in the project root and ancestor directories.
3. Check the trust dialog when you open the project.
4. If you selected Don't trust, close the session.
5. Open the project again and select Trust project.
6. Create a new session.

An open session keeps the trust state from its start. After a trust change, restart the session.

If the project root or an ancestor contains `.agents/skills`, PiS also lists it as a trust resource.

## No approval prompt

Check:

- The approval policy in Settings is not Allow all.
- Another guard extension is present.
- The operation is in the Smart check range.

Smart uses heuristics. Some commands and extension tools do not trigger an approval.

Select Ask all when every call must ask.
Clear Use PiS approvals to turn off built-in approvals.

## Too many approval prompts

Check:

- Ask all is selected.
- PiS approvals are forced on while another guard is also present.
- Commands often use paths outside the workspace.

You can:

- Switch to Smart.
- Select Allow for this session in the approval dialog.
- Turn off the duplicate guard.

## Plan mode does not block a change

Plan mode uses rules. It is not a sandbox.

Possible cases:

- A command runs through an interpreter, for example `python3 -c`.
- An extension tool is not registered as a change tool.
- The model uses a command outside the rules.

Use a read-only file system or a container when you need strict read-only behavior.

## A session does not open

Check:

- The project directory exists.
- The session file is still in the pi `sessions/` directory.
- pi can start.

Run `pi` in the project directory and confirm pi can start and use a model.

If the session file is damaged, try another session from the sidebar, or restore the file from a backup.

## A tool call fails

A tool card shows the error.

Common causes:

- The command does not exist.
- Permission is missing.
- The working directory does not exist.
- The network fails.

Expand the tool card to see the full output. After you fix the cause, send the message again.

## Update fails

Check:

1. The current version is older than the latest Release.
2. The Release is public.
3. The network can reach GitHub.
4. The update files for the current platform exist.
5. macOS did not block the app again with Gatekeeper.

Updates use an Ed25519 key. Do not change update files by hand.

## Settings are damaged

1. Quit PiS.
2. Open Diagnostics in Settings and note the data directory.
3. Move the data directory to a backup location.
4. Start PiS again.

PiS creates default settings.

Do not delete `~/.pi/agent`. It removes pi sessions and sign-in state.

## Old bridge files

PiS bridge files are in:

```text
extensions/pis-bridge-<version>.ts
```

A normal upgrade removes old files.

If you see several bridge files:

1. Quit PiS.
2. Start it again.
3. Check that the old files are gone.

Do not load an unknown extension by hand.

## Collect diagnostics

The diagnostics report in Settings contains:

- App version.
- Platform and architecture.
- Data directory.
- pi path and version.
- Settings load error.

Check the report for private paths before you send it.

When you open an issue, include:

- The diagnostics report.
- Reproduction steps.
- The error message.
- Operating system and pi version.

Do not include credentials, API keys, or a full private session.

## Next

- [Data, security, and privacy](/reference/data)
- [Settings](/guide/settings)
- [GitHub Issues](https://github.com/ModyQyW/pis/issues)
