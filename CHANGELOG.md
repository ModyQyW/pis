# Changelog

English | [简体中文](CHANGELOG.zh.md)

## 0.0.8 (2026-11-27)

- Add the Pi configuration dialog: review pi's default model, custom providers, skills, extensions, packages, and MCP servers, and confirm the list when it changes.
- Configure startup defaults, compatible providers and their models, skill and extension paths, and package sources in the GUI. Writes go to pi's `settings.json` and `models.json` only when you save; unknown fields survive, and stored API keys are never returned to the page.
- Show user MCP servers without a project, mark project servers as not loaded until trust, and include user MCP changes in the confirmation fingerprint.
- Accept pi's JSONC in `models.json` and warn before a save writes plain JSON.
- Add a Skills user guide and list the extensions with specific PiS support.

## 0.0.7 (2026-11-26)

- Add four color palettes (Amber, Graphite, Teal, and Ink) with separate light and dark tuning and a palette picker in Settings.
- Rebuild the visual system on one token layer: type scale, control boundaries, scrim, focus ring, dialog surfaces, and shared button, field, pill, and key primitives.
- Raise secondary text, muted labels, and success states to the 4.5:1 contrast floor; controls keep a 3:1 boundary.
- Persist the palette in settings (schema v3). Existing users keep Amber.
- Refresh the user and developer docs for palettes, tokens, and the settings fields.
- Stop generating delta update files and open each release note with a download table for the right installer.

## 0.0.6 (2026-11-25)

- Add English and Chinese UI strings across the shell, dialogs, composer, and settings.
- Add a bilingual user guide and developer docs; remove the development archive.
- Add a Chinese README and CHANGELOG, and make the CHANGELOG the only GitHub release record.
- Keep project trust aligned with pi by checking ancestor `.agents/skills` resources.
- Reject symlinked file reads that escape the workspace.
- Filter subagent sessions from the session list, cache sidebar summaries, and cap search reads.
- Bound pi JSONL records, propagate fork/clone cancellation, preserve unknown MCP fields, and reject duplicate servers.
- Restore rejected drafts, dismiss expired extension dialogs, and confirm forced worktree removal.
- Build, vet, and test only module Go packages; npm packages can ship Go code.
- Serialize release uploads, verify SHA256SUMS coverage, and require the Chinese CHANGELOG section before publishing.

## 0.0.5 (2026-11-24)

- Add a manual `Check for updates…` button to Settings. The Help menu item and
  the daily background check remain.
- Make a configured pi path authoritative: when it fails, Settings shows that
  path's error instead of a later auto-detected path.
- Resolve the login-shell `PATH` before pi discovery and before starting pi.
  Apps launched from Finder now run bun/npm-installed pi scripts that need
  node, including `~/.bun/bin/pi`.
- Auto-detect pi under `$BUN_INSTALL/bin` (default `~/.bun/bin`) and common
  npm, pnpm, and Volta global locations.
- `scripts/release.sh` publishes in one run: version, notes, full check,
  commit, tag, push, Release workflow, draft verification, and publication.
  `scripts/release.sh build` keeps the local build behavior used by CI.
- Improve pi errors: a missing path, a directory, and a failing `--version`
  now have distinct messages.

## 0.0.4 (2026-11-24)

- Publish the changes that were prepared in the unpublished 0.0.3 draft.
  0.0.4 is the public release; the 0.0.3 draft is not a release.
- Remove the unused `netlify.toml`. Netlify deployments use manual upload or
  dashboard settings. Update the deployment and release documentation.
- No application behavior changes from the 0.0.3 source. 0.0.4 changes the
  version, release notes, and documentation.

## 0.0.3 (2026-11-24, draft only)

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
- Add Cloudflare Pages and Netlify deployment instructions.
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
