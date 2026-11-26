# Project history

[English](history.md) | [简体中文](history.zh.md)

This page is the short record of how PiS was built. The measured research is in [Research](research.md). The accepted tradeoffs are in [Decisions](decisions.md).

## Origin

PiS started as a desktop shell around pi on mygo. The goal was a small native window with a rich transcript, real pi sessions, approvals, plan mode, extensions, and a release pipeline.

The project is not a second agent runtime. It does not bundle pi, store credentials, or replace pi data.

## Research

The research compared mygo, the pi RPC and SDK paths, and five existing pi clients. It ran prototypes for RPC sessions, extension UI, project trust, a resumed 243-message session, pty sign-in, and a mygo hello build.

Key findings:

- RPC reuses real pi extensions and isolates crashes.
- The SDK would require a second implementation of the loader, auth, and extension UI bridge.
- JSONL first paint is faster than waiting for `get_messages`.
- RPC cannot show pi's project trust prompt, so the app must ask.
- The pi RPC UI subset is a real limit; PiS should state it, not fake it.

See [Research](research.md) for the measurements and the competitor lessons.

## Decisions

[Decisions](decisions.md) contains the accepted ADRs. The main choices:

- RPC, not the SDK.
- One pi process per open session.
- App-side project trust before spawn.
- JSONL first paint; pi is authoritative.
- Delta-only streaming with a 16 ms coalescer.
- A bundled bridge with `pis-*` names.
- pi owns sessions, credentials, models, and trust.
- A small settings file and a system webview.

## Plan and build

The V1 plan set the scope, file layout, phases, test strategy, and verification commands. The build moved from the Go/React shell to real pi sessions, streaming Markdown, tool cards, approvals, plan mode, changes, worktrees, search, extensions, localization, and packaging.

[Features](features.md) maps the result to the current code. [Testing](testing.md) lists the verification matrix and the measured results.

## Quality and design

Every risky path has a test or a manual check: session parsing, streaming, approvals, trust, plan mode, file boundaries, MCP writes, settings migration, and process cleanup.

[UX and visual direction](ux.md) records the layout, visual system, components, transcript, composer, dialog dock, status, keyboard, and empty and error states.

## Releases

| Version | State |
|---|---|
| `0.0.1` | First public macOS, Windows, and Linux release |
| `0.0.2` | User guide, config typecheck, release version prompt |
| `0.0.3` | Never published; Vite+ gate, icon, docs split, smart approval fix |
| `0.0.4` | Public release of the 0.0.3 source; Netlify config removed |
| `0.0.5` | Manual update check, authoritative pi path, login-shell PATH, one-shot release script |
| `0.0.6` | Bilingual guides and UI, session and file hardening, CHANGELOG-driven releases |
| `0.0.7` | Palettes and a shared design system, download notes in releases, no delta assets |

The `0.0.3` tag was never published as a GitHub release. `0.0.7` is the current public release and latest.

## Current state

- macOS arm64 is the main runtime-validated platform.
- Windows and Linux artifacts build, but runtime QA is incomplete.
- macOS uses an ad-hoc signature and is not notarized.
- Windows uses an unsigned installer.
- Updates use GitHub Releases and an Ed25519 key.
- The documentation site is at `https://pis.modyqyw.top`.
- The user guide and developer guides are bilingual. The CHANGELOG is bilingual.

## Related

- [Research](research.md)
- [Decisions](decisions.md)
- [Pitfalls](pitfalls.md)
- [Release](release.md)
