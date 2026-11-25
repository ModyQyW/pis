# Sessions

A session is a pi session file. PiS does not keep a separate session database.

One project can have many sessions. Each open session has its own pi process and does not block the others.

## Create a session

Use one of these methods:

1. Click New chat in the sidebar.
2. Press `⌘N` (`Ctrl+N` on Windows and Linux).
3. Select File > New chat from the menu.

Open a project first. If the project needs trust, PiS shows the trust dialog first.

After creation, the pi process starts in the background. The transcript shows "Starting pi…" until pi is ready, then shows Ready.

A new session uses the default model and pi configuration of the project. You can change the model at any time.

## Resume a session

The Chats list in the sidebar shows recent sessions for the current project. Click a session to resume it.

PiS first reads the pi session JSONL file and shows the history. The pi process then starts and takes over new messages.

The sidebar shows the session title and update time. A session without a title uses the first user message as the title.

## Search sessions

Press `⌘K` to open the command palette, then type at least two characters.

The palette searches:

- Session titles.
- User and assistant messages in recent sessions of the current project.
- PiS commands and settings.

Results appear as rows. Click a result to open the session.

Search reads session files. It does not change them.

## Rename a session

Open the session actions menu at the top right, then select Rename session….

Enter a new name. pi saves the name. The sidebar and top bar update.

## Fork a session

Fork starts a new session from a user message.

1. Move the mouse over a user message.
2. Click Fork from here.
3. pi creates a new session and switches to it.

The original session stays on disk. You can open it again from the sidebar.

A fork keeps the content before the user message. Messages after the fork point do not enter the new session.

## Clone a branch

Clone copies the current active branch.

Open the session actions menu, then select Clone branch. pi creates a new session at the current position and switches to it.

Fork and clone differ in one way:

- Fork starts from a user message.
- Clone starts from the current active leaf and keeps the full branch.

## Session tree

The session tree shows the branches of the current session.

![Session tree](/images/session-tree.png)

Press `⌘⇧T`, or select Session tree… from the session actions menu.

The tree lists all nodes:

- User messages.
- Assistant messages.
- Compaction summaries.
- Branch summaries.
- Other pi entries.

The active node has a Current label.

Click a node to move the active leaf there. New messages continue from that node. The old branch stays on disk.

The bottom of the tree has two options:

- Summarize the branch I leave: ask pi to summarize the abandoned branch before the switch.
- Clone branch: copy the current branch without switching the original session.

## Export a session

Open the session actions menu, then select Export as HTML….

pi writes an HTML file next to the session file. PiS shows the export path.

The session must be open and the pi process must be available.

## Reveal the session file

Select Reveal session file. PiS opens the folder that contains the session file.

pi manages the session file. Do not change it by hand while pi runs.

## Close a session

Select Close session, or press `⌘W` (`Ctrl+W` on Windows and Linux).

Closing stops the pi process. It does not delete the session file. Open the session again to resume it.

## Delete a session

Select Delete session….

PiS closes the session, then moves the session file to the system Trash. Check the current session before you confirm.

You can restore the file from the system Trash. PiS has no separate undo.

## Multiple sessions

PiS can open multiple sessions. Each session has its own pi process.

PiS can send a system notification when a background run finishes. The setting is in Settings.

If sessions are running, PiS asks before you quit. Quit and stop stops all sessions.

## Next

- [Composer](/guide/composer): send messages and use attachments.
- [Changes and files](/guide/changes): review pi changes.
- [Trust, approvals, and plan mode](/guide/approvals): control tool calls.
