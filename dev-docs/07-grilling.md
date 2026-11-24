# Grilling: product questions and answers

This file records the design-tree questions, the recommendation, and the
answer. Later rounds append; settled answers are not reopened unless new
evidence appears.

Status: round 1 answered 2026-11-22. All recommendations accepted. Q6 extension-conflict constraint applied: namespaced bridge commands, no duplicate todo/ask/plan tools, guard detection defaults our approvals off when another guard is installed, and an existing plan command is surfaced rather than shadowed. Initial implementation delivered for validation.

## Round 1 — scope, shell, safety

### Q1. V1 scope

**Question.** How far toward Claude Code/Codex parity should the first version
go?

- A. Daily-driver core + plan/todo/ask-user, rich diffs: workspace/session
  management, streaming chat, tool cards, changes review, models/auth,
  real extensions, trust/approvals, plan mode, command palette, build. MCP and
  subagents use pi's extensions/CLI and generic cards; no bespoke boards.
- B. Full parity sprint: A plus MCP OAuth UI, worktree manager, subagent board,
  terminal panel, code editor. Wider but riskier and slower to polish.
- C. Thin shell: chat + sessions only. Fast to build, under-delivers.

**Recommendation:** A. It is a credible daily driver and leaves room for polish.
**Answer:** A (accepted 2026-11-22).

### Q2. How the app gets pi

- A. Require an installed pi (>=1.6 <2), find it via setting/PATH/login shell,
  and guide setup. Repo stays small; pi updates are the user's.
- B. Bundle the ~103 MB standalone pi for zero setup; larger app and version
  coupling.
- C. Auto-download official pi on first launch; zero setup but network/trust
  complexity.

**Recommendation:** A for v1, with a path picker and a copyable install command;
add C later if onboarding friction is real.
**Answer:** A (accepted 2026-11-22).

### Q3. Shell technology and feel

- A. mygo webview, hidden inset title bar, native menus, React 19/Vite/TS,
  Tailwind + Base UI/shadcn, Zustand, Virtuoso, Streamdown/Shiki.
- B. mygo native UI in Go; smaller/faster but requires rebuilding the entire
  rich UI and loses web ecosystem.
- C. mygo webview + Svelte/Solid; smaller bundle, smaller ecosystem.

**Recommendation:** A.
**Answer:** A (accepted 2026-11-22).

### Q4. Session concurrency

- A. One pi process per open session, kept alive while the app runs; switching
  never stops work; cap 6 live sessions; Sleep action.
- B. One active pi process; switching stops/suspends work; lower memory.
- C. One process per workspace; not supported by pi's session model.

**Recommendation:** A.
**Answer:** A (accepted 2026-11-22).

### Q5. Safety model

- A. Smart approvals by default: read-only auto; edits/writes in workspace auto;
  destructive/out-of-workspace/privileged bash and sensitive paths ask; Ask-all
  and Allow-all modes; once/session grants; no auto-deny; detect existing guard
  extensions and avoid double prompts.
- B. Pi-native autonomy; rely on installed guard extensions such as
  `cc-safety-net`; no app approvals.
- C. Ask for every tool call.

**Recommendation:** A, with a visible setting and an easy "use my existing guard"
path.
**Answer:** A (accepted 2026-11-22).

### Q6. Plan/todo/subagents/MCP

- A. Built-in Plan mode and todo panel; render ask-user; MCP list/config + CLI
  terminal; subagents generic cards + child links.
- B. Plan and todo only; MCP/subagents via pi CLI/extensions only.
- C. Full native MCP OAuth UI and subagent board.

**Recommendation:** A, but MCP/subagent UI is stretch; do not let it block core.
**Answer:** A (accepted 2026-11-22), with the constraint below.

**Q6 constraint (user).** Consider conflicts with already-installed extensions.

- Do not register another `todo` tool or `ask_user_question` tool. Render the
  installed `todo` results and custom entries; use the installed ask extension.
- Do not shadow generic commands such as `plan`, `todos`, or `subagents`.
  Bridge commands are namespaced `pis-*`.
- Detect installed guard extensions (for example `cc-safety-net`) and do not
  double-prompt by default. The app guard can be switched on explicitly.
- Detect an existing plan-mode command and surface it instead of claiming our
  toggle controls it; otherwise use our namespaced plan mode.
- Never remove, disable, or rewrite a user package to avoid a conflict.

### Q7. Change review and undo

- A. Read-only changes panel with per-file diff, copy patch, open in editor,
  reveal; no automatic revert.
- B. A plus per-file "Revert to HEAD" with confirmation.
- C. Turn-level git checkpoints and undo.

**Recommendation:** A for v1. B is a safe stretch; C mutates user repos and is
deferred until the safety model is proven.
**Answer:** A (accepted 2026-11-22).

### Q8. Platform and distribution

- A. macOS arm64 first, unsigned local `.app`/`.dmg`; code kept cross-platform;
  Windows/Linux untested.
- B. Full macOS/Windows/Linux QA now.
- C. macOS only, platform-specific shortcuts.

**Recommendation:** A. Signing/notarization/auto-update later.
**Answer:** A (accepted 2026-11-22).

### Q9. Language and name

- A. English UI, Chinese README/quickstart, all strings i18n-keyed; app name
  "PiS"; repo `pis`.
- B. Chinese-first UI.
- C. English only, strings inline.

**Recommendation:** A.
**Answer:** A (accepted 2026-11-22).

### Q10. Login UX

- A. In-app terminal sheet with a real pty running `pi auth login`; no credential
  persistence or logging.
- B. Open Terminal.app / copy the command.
- C. Custom auth forms writing pi's auth file.

**Recommendation:** A; C is rejected on safety grounds.
**Answer:** A (accepted 2026-11-22).

### Q11. Performance budgets

- A. Treat the budgets in ADR-013 as acceptance criteria and measure them.
- B. Best effort, no hard budgets.

**Recommendation:** A.
**Answer:** A (accepted 2026-11-22).

### Q12. Initial delivery

- A. Source + docs + `bun run build` app/DMG + test evidence; user validates on
  their machine with real pi.
- B. Also publish a signed GitHub release now (requires credentials/accounts).
- C. Source only.

**Recommendation:** A.
**Answer:** A (accepted 2026-11-22).

## Round 2 — to ask after round 1

Likely topics, not yet asked:

- Exact approval heuristic list and mode names.
- Plan-mode tool set and exit flow.
- Session tree interaction and branch summaries.
- Status/widget noise policy for existing packages.
- Diff panel scope and file preview limits.
- Notification behavior and focus rules.
- Onboarding copy and missing-pi recovery.
- Mock backend scope and visual QA tooling.
- Error/log retention and diagnostics redaction.
- Packaging name/identifier/icons.
