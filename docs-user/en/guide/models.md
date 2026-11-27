# Models and sign-in

PiS uses pi models and credentials. It does not keep its own copy of them.

## Review pi's configuration

PiS reads pi's configuration at launch. When the configuration changed since
you last confirmed it, the Pi configuration dialog opens. It lists:

- The default provider, model, and thinking level from `settings.json`.
- Custom providers and models from `models.json`.
- Skills, extensions, and packages.
- MCP servers from `mcp.json`.

Click Use this configuration to record the review. You can also open the
dialog from Settings → Pi resources → Models, providers, skills….

PiS writes pi's files only when you save in the dialog. It never writes
pi's `auth.json`, `trust.json`, or session files.

## Sign in to a provider

There are two entry points:

1. Sign in to a provider… in Settings.
2. The Connect a provider prompt in the chat area.

![Provider sign-in](/images/login.png)

Steps:

1. Enter a provider ID, for example `anthropic`, `openai`, `google`, or `openrouter`.
2. Select a sign-in method.
3. Click Start sign-in.
4. Finish the sign-in in the terminal inside the app.

Sign-in methods:

| Method | Behavior |
|---|---|
| Account sign-in | Opens the provider's browser sign-in flow |
| API key | Asks for the key in the terminal |

The actual command is:

```sh
pi auth login <provider>
```

PiS provides only the terminal for pi. pi stores the credentials.

Notes:

- PiS does not log the terminal output.
- The diagnostics report does not contain credentials.
- Only one sign-in terminal can be open at a time.
- Closing the sign-in window stops the sign-in process.
- If you are not sure of the provider ID, read the [pi provider documentation](https://pi.dev/docs/latest/providers).

After sign-in, PiS refreshes the model list.

## Configure defaults and custom providers

Open Settings → Pi resources → Models, providers, skills….

Defaults:

- Default provider and model: the startup choice for pi and new sessions.
- Thinking level: the startup level. Automatic uses pi's own choice.
- Empty values remove the setting, so pi chooses automatically.

Models and providers:

- The dialog lists the providers in pi's `models.json`.
- Add provider creates a provider with a base URL, API type, key, and models.
- Each model has an ID, optional name, context window, maximum output, and a
  reasoning flag.
- The model picker switches one session. The default affects new sessions.

Available model names come from `pi --list-models`. Built-in providers use pi
sign-in; `models.json` adds compatible endpoints and model overrides.

When you save a custom provider key, the key is written to pi's `models.json`.
PiS never reads it back, and the field stays blank on the next edit. `$NAME`
uses an environment variable when pi starts. Advanced fields such as `compat`,
`headers`, `cost`, and `modelOverrides` stay editable in `models.json`.

pi accepts `//` comments and trailing commas in `models.json`. PiS reads them.
When you save from PiS, the file becomes plain JSON and the comments are
removed. The dialog shows a warning when this will happen.

## Model picker

Open a session, then click the model name below the composer.

The model picker shows:

- The current model.
- The available models.
- The provider and context window for each model.
- The thinking levels for the current model.
- The automatic context compaction switch.

The model list comes from pi configuration and sign-in state. Click the refresh button to read it again.

After you select a model, the switch affects only the current session. New sessions use the pi default model.

## Thinking level

Some models support thinking levels.

pi provides the available levels. They usually include `off`, `low`, `medium`, and `high`. Different models can have different ranges.

After a change, the next messages use the new thinking level.

## Automatic context compaction

pi can compact the context automatically near the limit.

- The switch is on by default.
- When you turn it off, a run can fail at the context limit.
- You can also select Compact context… from the menu to compact manually.

After compaction, the transcript shows a summary. PiS keeps the history on screen. pi continues with the summary.

## Context usage

The bottom right of the composer shows the context usage percentage.

The percentage comes from pi session statistics. It includes the system prompt, tool definitions, history, and the current answer.

When usage is high, you can:

- Compact the context manually.
- Create a new session.
- Switch to a model with a larger context window.

## No models available

If sign-in or model configuration is missing, the chat area shows "No models are available".

Steps:

1. Click Connect or open Settings.
2. Complete provider sign-in.
3. Return to the session and click the refresh button in the model picker.

If models are still missing, check pi model configuration and sign-in state. See the [pi documentation](https://pi.dev/docs/latest/models).

## Credential safety

- Credentials are in the pi directory.
- PiS does not read pi's `auth.json`.
- A custom provider key that you save goes to pi's `models.json`. PiS does not
  show it again and does not store it in its own settings.
- PiS does not write credentials to logs, diagnostics, or session files.
- Do not save API keys in project files.
- Do not post screenshots or logs with secrets to a public issue.

## Next

- [MCP servers](/guide/mcp): connect external tools.
- [Settings](/guide/settings): change settings other than models.
- [Troubleshooting](/reference/troubleshooting): solve sign-in and model problems.
