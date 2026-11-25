# Extensions

PiS uses the pi extension system. pi loads extensions, and PiS displays their interface and results.

## Extension locations

Common pi locations:

```text
~/.pi/agent/extensions/     user level
<project>/.pi/extensions/   project level
```

You can also install extensions with pi package management. See the pi documentation for the install method.

A project extension triggers project trust before it loads. Load only code you have checked.

Extensions have the same system permissions as pi. Read the source or the release notes before you install one.

## Load extensions

pi loads extensions when a session starts.

After you change an extension, close the session and open it again. The specific load behavior depends on the extension documentation.

PiS does not install extensions and does not keep a second extension list.

## Extension interface

PiS supports the interface that pi RPC provides:

| pi capability | PiS display |
|---|---|
| Tool calls and results | Tool cards |
| `select` | Inline select dialog |
| `confirm` | Inline confirm dialog |
| `input` | Inline input box |
| `editor` | Inline multiline editor |
| `notify` | Toast notification |
| `setStatus` | Status rail above the composer |
| `setWidget` | Expandable widget area when the setting is on |
| `set_editor_text` | Write to the composer |

Extension dialogs appear above the composer. They do not cover the transcript.

![Extension dialog example](/images/approval.png)

## Unsupported interface

The pi RPC mode does not support some terminal interface features:

- `ctx.ui.custom()` custom components.
- Custom editors and terminal input.
- Terminal theme switching.
- Terminal header, footer, and working message.
- `setTitle`: PiS stores the extension title, but the current interface does not display it.
- Some TUI-only features.

PiS does not fake these features. An extension must detect the runtime and provide a text or RPC fallback.

If an extension provides only `custom()`, it may have no interface in PiS. Read the extension documentation.

## Built-in bridge

PiS includes a small bridge extension that fills RPC gaps.

File location:

```text
~/Library/Application Support/PiS/extensions/pis-bridge-<version>.ts
```

It registers only `pis-*` names:

- `/pis-navigate`: session tree navigation.
- `/pis-plan`: plan mode.
- `pis:plan` and `pis:guard`: status keys.

It registers only `pis-*` names and does not take common names from other extensions. It will not hide an extension you installed.

PiS removes old bridge files during an upgrade. Do not load an unknown bridge by hand.

## Extension conflicts

- When another guard extension is present, PiS turns off built-in approvals by default.
- When another plan command is installed, the interface uses that command.
- Extension errors appear in the session and are not dropped.

## Tool cards

Built-in tools have dedicated cards:

- shell
- read
- edit
- write
- grep
- find
- ls
- todo
- ask_user_question
- subagent

Other extension tools use a generic card. The generic card shows the tool name, arguments, result, and error state.

## Status and widgets

An extension can set status text.

- The status appears above the composer.
- PiS shows up to 6 status entries.
- ANSI color codes are removed.
- Widgets are off by default. You can turn them on in Settings.

Widgets use a terminal layout. They can take a lot of space.

## Extension errors

When an extension throws an error, the session shows the source and the message.

Steps:

1. Check whether the extension supports pi RPC mode.
2. Check the extension version.
3. Close the session and open it again.
4. Reproduce the problem in pi's terminal mode.

## Next

- [Trust, approvals, and plan mode](/guide/approvals): control extension tool permissions.
- [Settings](/guide/settings): turn on widgets and notifications.
- [Troubleshooting](/reference/troubleshooting): solve extension load problems.
