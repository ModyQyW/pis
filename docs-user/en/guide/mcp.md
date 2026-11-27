# MCP servers

MCP is the Model Context Protocol. MCP servers provide extra tools and resources to pi.

PiS manages the MCP configuration files. pi handles connections, authentication, and tool calls.

![MCP servers dialog](/images/mcp.png)

## Configuration files

pi reads two files:

```text
~/.pi/agent/mcp.json              user level
<project>/.pi/mcp.json            project level
```

Rules:

- A project entry overrides a user entry with the same name.
- Project configuration loads only after the project is trusted.
- A project entry can contain only fields such as `enabled`, and inherit connection details from the user entry.
- PiS does not delete unknown fields when it edits a file.

PiS does not connect to servers and does not store MCP credentials. PiS links to pi's [MCP documentation](https://pi.dev/docs/latest/mcp) in the MCP settings and dialog.

## Open the dialog

Open it from the command palette or Settings:

1. Press `⌘K`.
2. Select Manage MCP servers….
3. Or open Settings → Pi configuration → MCP servers, then click Open MCP servers.

The Pi configuration dialog shows the configured servers. Its Open MCP
servers button opens the same dialog. It shows user servers without a project.
A project server is marked not loaded until you trust the project.

The dialog needs a current project. Without a project, it asks you to open one.

## View servers

The Configured list shows the merged servers.

Each entry shows:

- The name.
- The source: `user` or `project`.
- The type: `stdio` or `http`.
- The command and arguments, or the URL.
- The description.
- The enabled checkbox.
- The remove button.

The enabled checkbox writes to the file that defines the server:

- A user-level server writes to the user `mcp.json`.
- A project-level server writes to the project `mcp.json`.

After saving, reload the session. You can also run `/mcp` in pi to reconnect.

## Add a server

The form at the bottom of the dialog adds a server.

Fields:

| Field | Description |
|---|---|
| Server name | Letters, digits, `_`, and `-` only |
| Description | Optional; helps the model decide when to use the server |
| Command | The command for a stdio server |
| Arguments | Separated by spaces |
| URL | The address of an http server |
| Project local | Write to `.pi/mcp.json` |

Enter a command or a URL. Do not enter both.

After you click Add server:

- PiS reports an error if the name already exists. It does not replace the old entry.
- PiS writes the new entry to the selected file.
- PiS checks the JSON and writes the file atomically.

PiS splits arguments on spaces. If an argument contains a space, add the server first, then edit `mcp.json`.

## Advanced fields

Edit these fields in `mcp.json` by hand:

- Environment variables: `env`.
- HTTP headers: `headers`.
- OAuth configuration.
- Timeout: `timeout`.
- Tool exposure: `exposure` and `toolExposure`.
- Working directory: `cwd`.

PiS preserves these fields. Changing the enabled state or removing another entry does not clear them.

## Remove a server

Click the remove button on an entry.

After you confirm, PiS deletes the entry from its file.

Removing a server does not uninstall the package. For example, a package downloaded by `npx` remains in the local cache.

## Common problems

### A project server is missing

Check project trust. An untrusted project does not load `.pi/mcp.json`.

### No tools after adding a server

1. Reload the session.
2. Run `/mcp` in pi and check the connection state.
3. Check that the command exists, or that the URL is reachable.
4. Check that `mcp.json` is valid JSON.

### The server fails to start

pi reports the error in the session. Check:

- The command path.
- `env`.
- Network and proxy settings.
- The server log.

### Name conflict

Server names can contain only letters, digits, `_`, and `-`. Names that differ only in `-` and `_` can be treated as the same server.

Use a unique name. Do not rely on case to separate names.

## Next

- [Models and sign-in](/guide/models): configure models.
- [Extensions](/guide/extensions): learn about other pi extensions.
- [Troubleshooting](/reference/troubleshooting): solve connection problems.
