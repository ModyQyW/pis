# Trust, approvals, and plan mode

Three features control different scopes:

| Feature | Scope |
|---|---|
| Project trust | Whether project-level pi resources load |
| Approval | Whether one tool call runs |
| Plan mode | Whether the current session can change files |

None of them replaces system isolation.

## Project trust

pi can load project-level resources. These resources can contain executable code:

- `.pi/settings.json`
- `.pi/mcp.json`
- `.pi/extensions`
- `.pi/skills`
- `.pi/prompts`
- `.pi/themes`
- `.pi/SYSTEM.md`
- `.pi/APPEND_SYSTEM.md`
- `.agents/skills` in the project root or an ancestor directory

PiS shows a trust dialog the first time you open a project with these resources.

![Project trust dialog](/images/trust.png)

The dialog lists the detected resources. Check the paths and content, then select:

- Trust project: pi loads these resources.
- Don't trust: pi skips them.

PiS reads pi's trust record but does not write to it. PiS stores its own decision in its settings.

An open session keeps the trust state from its start. After you change trust, close the session and open it again.

Trust only a project you have checked. Extensions and skills can change model behavior. Extensions can also run code.

## Approval

An approval decides whether one tool call runs.

PiS has three policies:

| Policy | Behavior |
|---|---|
| Smart | Ask before destructive commands, sensitive files, and operations outside the workspace |
| Ask all | Ask for every tool call that needs approval |
| Allow all | Do not show built-in approvals |

### What Smart checks

Smart checks:

- Destructive shell commands, for example recursive deletion, forced Git operations, system changes, and package installs.
- Paths outside the workspace, including absolute paths, `../` paths, and `$HOME` paths.
- Sensitive files, for example `.env`, SSH private keys, npm and PyPI credentials, and `auth.json`.
- Edits or writes to files outside the workspace.
- Extension tools whose names look like tools that change files.

Smart uses heuristics. It does not cover every command. A script interpreter can bypass the command checks, for example:

```sh
python3 -c "open('file.txt', 'w').write('x')"
```

Use a container, a VM, a restricted user, or pi's own isolation when you need a hard boundary.

### Approval dialog

![Approval dialog](/images/approval.png)

The dialog shows:

- The tool name.
- The command or file path.
- The reason for the approval.
- Three options.

Options:

| Option | Result |
|---|---|
| Allow once | Allow this call |
| Allow for this session | Do not ask again for the same operation in this session |
| Deny | Block the call and return the result to the model |

PiS does not auto-deny. The request waits until you choose.

### Other guard extensions

PiS detects common guard extensions, for example `cc-safety-net`.

When another guard is present, PiS turns off built-in approvals by default. When both guards are on, you see two prompts.

You can force PiS approvals on in Settings. When both guards are on, each tool call can ask twice.

## Plan mode

Plan mode switches the session to read-only exploration.

![Plan mode](/images/plan.png)

To turn it on:

1. Click Plan below the composer.
2. The button shows Planning when plan mode is on.

Plan mode:

- Limits pi to read-only tools.
- Blocks file edits and writes.
- Blocks common mutating shell commands, for example `git push`, `git stash`, `git rm`, `mv`, and `cp`.
- Makes the model write a plan first.

After you turn plan mode off, pi restores the original tool set.

PiS stores plan mode in the session. It restores plan mode when you open the session again.

### Limits of plan mode

Plan mode is a workflow guard, not a security boundary.

The command checks use rules. Interpreter commands and unknown extension tools can bypass them. For example, `python3 -c` can write a file.

Use a read-only file system, a container, or a restricted account when you need strict read-only behavior.

### Other plan commands

If the project already has another plan command, PiS shows that command.

When you click Plan, PiS inserts the command into the composer and does not control built-in plan mode.

## Markdown images

Markdown images in a session load directly, including `http(s)` URLs.

Model output or an imported session can reference a remote image. Loading the image makes a network request. It can reveal your IP address and can reach services on this computer.

Links still open only after a click. The renderer blocks `data:` and `file:` images.

This behavior is intentional. See ADR-019 in the repository. Use a sandbox when you need a strict network boundary.

## Next

- [Models and sign-in](/guide/models): sign in to a provider.
- [Settings](/guide/settings): change the approval policy and notifications.
- [Troubleshooting](/reference/troubleshooting): solve trust and approval problems.
