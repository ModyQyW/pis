# Projects

A project is a working directory for PiS. A project is usually a Git repository, but it can be any folder.

## Open a project

Use one of these methods:

1. Click Open a project folder in the sidebar.
2. Press `⌘O` (`Ctrl+O` on Windows and Linux).
3. Select File > Open project… from the menu.

After you select a directory, PiS adds it to the project list and makes it the current project.

The project name is the directory name. PiS does not change project files and does not create its own database.

## Switch projects

Click a project in the sidebar to switch the current project.

After a switch:

- The top bar shows the new project name.
- The chat list shows sessions for the new project.
- The composer uses the new project as its working directory.

Open sessions stay open. Each session has its own pi process and working directory.

## Recent projects

The sidebar lists projects by last opened time. PiS keeps up to 20 recent projects.

On the next launch, PiS restores the last project and the last opened session.

If the last project was moved or deleted, opening a session can fail. Open the project directory again.

## Project trust

PiS shows a trust dialog the first time you open a project with project-level pi resources.

Project-level resources include:

- `.pi/settings.json`
- `.pi/mcp.json`
- `.pi/extensions`
- `.pi/skills`
- `.pi/prompts`
- `.pi/themes`
- `.pi/SYSTEM.md`
- `.pi/APPEND_SYSTEM.md`
- `.agents/skills` in the project root or an ancestor directory

Select Trust project to let pi load these resources. Select Don't trust to let pi skip them.

PiS stores the decision per project. An open session keeps the trust state from its start. To change the trust scope, close the session and open a new one.

See [Trust, approvals, and plan mode](/guide/approvals) for the full trust dialog.

## Worktrees

Git worktrees let one repository have multiple checkouts.

PiS can list, create, open, and remove worktrees. You can open a worktree directory as a normal project.

See [Worktrees](/guide/worktrees) for the full use.

## Project files

PiS reads project files. It does not replace project files and does not create hidden directories in the project.

pi can run commands and change files in the project. The result depends on the tools you allow and the approval policy.

## Next

- [Sessions](/guide/sessions): create and resume sessions.
- [Composer](/guide/composer): send messages.
- [Worktrees](/guide/worktrees): check out one repository in parallel.
