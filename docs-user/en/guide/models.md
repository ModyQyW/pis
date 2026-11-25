# Models and sign-in

PiS uses pi models and credentials. It does not store API keys or manage accounts.

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
- PiS does not read credential content.
- PiS does not write credentials to logs, diagnostics, or session files.
- Do not save API keys in project files.
- Do not post screenshots or logs with secrets to a public issue.

## Next

- [MCP servers](/guide/mcp): connect external tools.
- [Settings](/guide/settings): change settings other than models.
- [Troubleshooting](/reference/troubleshooting): solve sign-in and model problems.
