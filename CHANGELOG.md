# Changelog

## 0.0.3 (2026-11-24)

- Add Vite+ 1.8 (Oxlint, Oxfmt, tsrs) as the frontend format/lint/type-check
  gate; `bun run format` formats, and `bun run check` / `scripts/check.sh`
  cover Go and Vite+ checks.
- Remove the separate `tsc` typecheck commands; Vite+ typechecks the frontend,
  bridge, and root configs in one pass.
- Install a Vite+ pre-commit hook through `vp config --no-agent`; every commit
  runs the full verification gate.
- Replace the πS mark with a monochrome π + flexed-arm icon; ship white- and
  black-background variants, defaulting to white. The development app uses the
  dark-background variant.
- Split the Rspress user guide into `docs-user/` and the research, decisions,
  progress, QA, and delivery notes into `docs-dev/`.
- Add Cloudflare Pages and Netlify deployment instructions. Add
  `netlify.toml` for the Netlify Git integration.
- Fix smart approvals' destructive-command table (regexes were typed as rules)
  and bump the bridge version so installed bridge copies refresh.

## 0.0.2 (2026-11-24)

- Add the Rspress user guide in `docs-user/`, with guides from first launch to
  architecture and release work.
- Add a root `tsconfig.json` and config typecheck to the verification gate.
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
