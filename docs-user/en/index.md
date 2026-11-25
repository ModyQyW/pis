---
pageType: home
hero:
  name: PiS
  text: A desktop shell for pi
  tagline: Use the pi you installed to work with projects, sessions, tools, and extensions in a native window.
  image:
    src: /images/empty.png
    alt: PiS desktop window
  actions:
    - theme: brand
      text: Install PiS
      link: /guide/install
    - theme: alt
      text: See the interface
      link: /guide/interface
features:
  - title: Use your existing pi
    details: PiS runs the pi you installed and signed in to. It uses your models, credentials, sessions, skills, prompt templates, and extensions.
  - title: Built for long sessions
    details: Streaming Markdown, a virtualized transcript, fast first paint, tool cards, a changes panel, and a session tree.
  - title: Bounded automation
    details: Project trust, Smart approvals, read-only plan mode, and a quit guard. Use a container or a VM when you need a hard boundary.
  - title: Existing extensions keep working
    details: pi extensions load through RPC. Dialogs, statuses, widgets, and tool results have a place to display.
---

## What PiS is

PiS is a desktop window that displays and operates pi sessions.

PiS does not include a model, store credentials, or replace pi data:

```text
PiS window
  └─ your installed pi
       ├─ your models and credentials
       ├─ your sessions, skills, and extensions
       └─ your project tools
```

## Start

1. Install pi, then sign in once. See the [pi documentation](https://pi.dev/docs/latest/quickstart).
2. Install PiS. See [Install and first run](/guide/install).
3. Open a project directory.
4. Write your goal in the composer and press Enter.

## How to read this guide

- First run: read [Install and first run](/guide/install) and [Window and interface](/guide/interface).
- Daily use: read [Projects](/guide/projects), [Sessions](/guide/sessions), [Composer](/guide/composer), and [Changes and files](/guide/changes).
- Control automation: read [Trust, approvals, and plan mode](/guide/approvals).
- Sign-in and models: read [Models and sign-in](/guide/models).
- Problems: read [Troubleshooting](/reference/troubleshooting).

Developer documentation is in [`docs-dev/`](https://github.com/ModyQyW/pis/tree/main/docs-dev). This guide covers only how to use PiS.
