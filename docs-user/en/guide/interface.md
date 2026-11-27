# Window and interface

The PiS window has five areas: the sidebar, the top bar, the transcript, the composer, and the right panel.

![PiS main window](/images/chat.png)

## Sidebar

The sidebar is on the left. You can hide it.

- The top has the PiS name and the New chat button.
- The search field filters projects and their chats. Clearing it restores the tree.
- Projects lists recent projects as expandable nodes. Click a project name to switch workspace; click the chevron to show or hide its chats.
- Each project shows its open and recent chats. Click a chat to resume it. Expand or collapse a project with the chevron.
- Select chats in the Projects header turns chat rows into checkboxes for bulk deletion.
- The bottom has Settings and the current pi version.

Press `⌘B` (`Ctrl+B` on Windows and Linux) to show or hide the sidebar.

## Top bar

The top bar shows the current location and state.

- The left side shows "project > session".
- The Ready, Working, Needs input, Error, and Sleeping labels show the session state.
- The Commands button opens the command palette. You can also press `⌘K` (`Ctrl+K` on Windows and Linux).
- The button on the right shows or hides the right panel. The shortcut is `⌘⇧G`.

A running session keeps the Working label. A session that waits for an approval shows Needs input.

## Transcript

The transcript shows the current session.

- User messages appear as bubbles.
- Assistant messages support Markdown, tables, code blocks, math, and Mermaid diagrams.
- Thinking blocks are collapsed by default. Click the title to expand one. The
  title shows an approximate duration. Intermediate text that belongs to a tool
  step is inside that thinking block.
- Tool calls appear as single-line cards. Output stays hidden until you click a
  card title. The expanded card shows arguments, output, diffs, and images. Long
  output starts with a fixed height and a Show all button; use Show less to
  collapse it.
- A question card with several questions shows one at a time. Use the previous
  and next buttons to move between them.
- Each message shows its local time. Hover an assistant message to see its model,
  token count, cost, and duration. A stopped run shows the stop reason.
- Context compaction, branch summaries, extension messages, and background task
  notices appear as separators.
- When you scroll up, new messages do not pull you back to the bottom. Click the down button at the bottom to return to the latest message.

Long sessions use a virtual list. PiS renders only the messages near the visible area.

## Composer

The composer is at the bottom. It sends messages, adds files, and selects the model.

See [Composer](/guide/composer) for the full use.

## Right panel

The right panel is hidden by default. Click the button at the right of the top bar, or press `⌘⇧G`.

The right panel has four tabs:

| Tab | Content |
|---|---|
| Changes | Git branch, file status, diff, and revert |
| Files | Project files and read-only preview |
| Plan | pi todos and progress |
| Agents | Subagent activity |

See [Changes and files](/guide/changes) for the full use.

## Inline dialogs

Approvals and extension dialogs appear above the composer. They do not cover the transcript.

- An approval dialog shows the tool name, command or path, risk reason, and options.
- An extension dialog supports select, confirm, input, and multiline edit.
- PiS shows one dialog at a time. Click the close button at the top right to cancel a request. Queued requests appear after the current one.

## Quit guard

If sessions are running, PiS asks before you quit.

- Cancel keeps the app open.
- Quit and stop stops all pi processes.

Session files stay on disk and can be resumed later.

## Menus

The menu bar provides common actions:

- File: New chat, Open project, Close session, Settings.
- View: Command palette, sidebar, right panel, reload, developer tools, zoom, full screen.
- Session: Stop run, Compact context, Session tree, Model & thinking, Rename, Export as HTML, Reveal session file.
- Help: Check for updates, pi documentation, mygo documentation.

Windows and Linux use a window menu with the same text. Chinese mode does not translate native menus.

## Next

- [Projects](/guide/projects): manage projects and the recent list.
- [Sessions](/guide/sessions): create and manage sessions.
- [Composer](/guide/composer): send messages, add files, and select a model.
