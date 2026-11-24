# Changelog

## 0.0.2 (2026-11-24)

- Add the Rspress user guide in `site-docs/`, with guides from first launch to
  architecture and release work.
- Add a root `tsconfig.json` and config typecheck to `scripts/verify.sh`.
- `release.sh` now prompts for a version with a suggested next patch version
  when `PIS_VERSION` is not set, and validates the result.
- Refresh the approval screenshot and release documentation.
- No runtime behavior changes from 0.0.1.

## 0.0.1 (2026-11-24)

- Initial public macOS, Windows, and Linux release of PiS.
- Product identity is PiS (`pis`), with a new πS icon and refreshed desktop
  screenshots. The S stands for strong.
- Real pi sessions, streaming transcript, tool cards, approvals, plan mode,
  session tree, changes, and extensions.
- TanStack Virtual transcript, Streamdown code/Mermaid plugins, and native
  desktop shell.
- MCP configuration, worktrees, session text search, todo panel, per-file
  revert, and native completion notifications.
