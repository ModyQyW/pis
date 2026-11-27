# Design system

[English](design-system.md) | [简体中文](design-system.zh.md)

This page is the implementation reference for PiS's visual language. [`styles.css`](../frontend/src/styles.css) is the source of truth for values; this page explains how to use them and how to extend them without drifting.

Read [UX and visual direction](ux.md) first for layout and interaction intent.

## Layers

1. **Raw layer**: palette blocks set `--canvas`, `--surface`, `--fg`, `--brand`, and the other base values. Only palettes define these.
2. **Semantic layer**: components use names such as `bg-surface`, `text-subtle`, `border-control`, and `bg-brand-soft`. Shadcn-compatible aliases (`background`, `foreground`, `primary`, `popover`, `muted`, `destructive`, and so on) map onto the same values.
3. **Utility layer**: typography, radius, shadows, containers, and motion are exposed as Tailwind tokens (`text-body`, `rounded-lg`, `shadow-dialog`, `max-w-chat`).

Do not use raw hex values, `text-[13px]`, or `bg-black/30` in components. If a value is missing, add a token instead of an arbitrary class.

## Palettes

Appearance is mode (System, Light, Dark) times palette. Each palette is tuned for both modes with `light-dark()`; the mode is applied by the `.dark` class and `color-scheme`.

| Palette | Canvas | Surface | Brand | Brand ink |
|---|---|---|---|---|
| Amber (default) | `#f7f6f3` / `#141413` | `#fbfaf8` / `#1b1a18` | `#b45309` / `#e88a4b` | `#94400a` / `#f2a973` |
| Graphite | `#f6f7f8` / `#101315` | `#fbfcfd` / `#171b1e` | `#2f6fbf` / `#6aa9ef` | `#1b5399` / `#9cc9f7` |
| Teal | `#f5f7f6` / `#0f1413` | `#fafcfb` / `#161c1a` | `#0f6f6a` / `#4fb8b0` | `#0a514d` / `#8bd6cf` |
| Ink | `#f7f7f7` / `#111111` | `#fcfcfc` / `#181818` | `#2a2a2a` / `#f0f0f0` | `#1a1a1a` / `#ffffff` |

Rules:

- Primary actions use `primary` (near-black in light, near-white in dark), not the brand color.
- Brand marks identity, active state, and the focus ring. `brand-ink` is the text-safe brand color.
- Success, warning, and danger are shared across palettes.
- The terminal stays dark in every palette through `--term-bg`, `--term-fg`, and `--term-selection`.

### Adding or changing a palette

1. Add a `[data-palette="id"]` block in `styles.css` with every token: canvas, surface 1–3, fg, subtle, faint, border, border-strong, control, brand, brand-ink, brand-soft, brand-fg, success, warning, danger.
2. Check contrast: body and 11–12 px labels at 4.5:1; icons and control boundaries at 3:1. Check both modes.
3. Add the id to `settings.Palette` and `Valid()` in `internal/settings/settings.go`, and to `PALETTES`/`Palette` in `frontend/src/lib/types.ts`. Do not edit `frontend/src/mygo.ts`; it is generated and keeps palette ids as `string`.
4. Add it to the palette list and Chinese names in `frontend/src/lib/i18n.ts`, and to the mock settings.
5. Add a preview entry to `PALETTES` in `SettingsDialog.tsx`; the card renders the palette's own tokens through `data-palette`.
6. Run `bun run check:web`, `go test ./internal/settings/`, and add a migration test when the schema changes.

## Type

| Token | Size | Line height | Use |
|---|---|---|---|
| `text-micro` | 11 px | 1.45 | Uppercase labels, metadata, counts, keycaps |
| `text-label` | 12 px | 1.45 | Buttons, form labels, dense rows |
| `text-body` | 13.5 px | 1.7 | Markdown, composer, transcript |
| `text-body-lg` | 14 px | 1.6 | Dialog titles, message wrappers |
| `text-title` | 16 px | 1.35 | Page or card titles |
| `text-heading` | 20 px | 1.25 | Section headings |
| `text-display` | 30 px | 1.15 | Empty-state headline |

The desktop body size is intentionally below the 16 px web baseline. Do not introduce smaller text: 11 px is the floor, and labels at that size still need 4.5:1 contrast. Code uses `--code-font-size`, set by the code font size setting. Markdown tables use `text-label`.

`cn` learns these custom text sizes from `frontend/src/lib/cn-tables.ts`; run `bun run cn:build` after changing a `--text-*` token so size and color utilities keep merging correctly.

## Spacing, radius, shadows, motion

- Spacing follows the 4 px Tailwind scale. Common rhythm: 2, 6, 8, 12, 16, 24.
- Radius: `xs` 4, `sm` 6, `md` 8, `lg` 10, `xl` 12, `2xl` 16. Controls use `md`; cards and dialogs use `lg`/`xl`.
- Shadows: `shadow-popover`, `shadow-dialog`, `shadow-float`. Floating layers use one of these; nothing else.
- One scrim: `--scrim`, applied through `DialogOverlay` and the narrow-window sheet scrims.
- Motion: 120 ms fast, 160 ms base, 200 ms slow, ease-out. Respect `prefers-reduced-motion`. The streaming cursor is the only continuous animation apart from `pulse-soft` status dots.

## Components

| Component | Location | Notes |
|---|---|---|
| `Button` | `components/ui/button.tsx` | Variants: primary, secondary, outline, ghost, brand, destructive, quiet. Sizes: xs, sm, md, lg, icon, icon-xs, icon-sm, icon-lg. |
| `DialogSurface` / `DialogHeader` | `components/ui/dialog-shell.tsx` | Widths 440, 600, 720, 900. Shared border, header, close button, body and footer rhythm. |
| `DialogOverlay` | `components/ui/dialog-shell.tsx` | The only scrim implementation. |
| `Field`, `TextInput`, `Textarea` | `components/ui/field.tsx` | Linked label via `htmlFor`, 3:1 control border, brand focus. |
| `Select` | `components/ui/select.tsx` | Base UI single select. Do not use native `<select>`. |
| `Combobox` | `components/ui/combobox.tsx` | Base UI searchable single select. Supports a side rail in the popup. |
| `Checkbox` | `components/ui/checkbox.tsx` | Base UI checkbox. Do not use native `type="checkbox"`. |
| `SectionLabel` | `components/ui/section-label.tsx` | 11 px uppercase grouping label. |
| `Kbd` | `components/ui/kbd.tsx` | Keycap with consistent border and size. |
| `StatusPill` | `components/ui/status-pill.tsx` | Tones: neutral, ready, brand, success, warning, danger, faint. |
| `Message`, `Bubble`, `Marker`, `Trace` | `components/ui/` | Transcript primitives. |
| `Toast` | `components/ui/toast.tsx` | Uses popover surface and the popover shadow. |

Product-specific surfaces (tool cards, diff, approval dock, extension rail, changes panel, composer) use the same tokens but keep their own layout.

## Accessibility rules

- Body and label text: 4.5:1 on its actual background, including tinted pills and active rows.
- Large text, icons, and control boundaries: 3:1.
- Never rely on color alone; pair dots and tints with text.
- Every control has an accessible name. Inputs use `htmlFor` or `aria-label`.
- Single-choice buttons expose `aria-pressed`.
- Global focus: 2 px `--focus-ring` outline with a 2 px offset. Do not remove it.
- Prefer real text over icon-only controls; icon-only buttons need `aria-label` and a title.

## Responsive behavior

- Below 900 px: the sidebar becomes a fixed overlay with a scrim. Selecting a project, session, or Settings closes it.
- Below 1100 px: the right panel becomes a fixed sheet with a scrim.
- Dialogs use `calc(100vw - 48px)` widths so they remain inside the window at any interface scale.

## Verification

- `bun run check:web`: format, lint, typecheck.
- `go test ./internal/settings/ ./internal/app/`: palette persistence and migration.
- Visual checks: every palette in both modes, 11 px labels, focus rings, narrow-window overlays. See [Testing](testing.md).

## Related

- [UX and visual direction](ux.md)
- [Feature implementation](features.md)
- [Testing](testing.md)
