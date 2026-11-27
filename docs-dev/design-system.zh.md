# 设计体系

[English](design-system.md) | 简体中文

本页是 PiS 视觉语言的实现参考。[`styles.css`](../frontend/src/styles.css) 是数值的唯一来源；本页说明如何使用和扩展它，避免规范漂移。

先阅读[UX 与视觉方向](ux.zh.md)了解布局与交互意图。

## 分层

1. **原始层**：色板块定义 `--canvas`、`--surface`、`--fg`、`--brand` 等基础值。只有色板可以定义这些值。
2. **语义层**：组件使用 `bg-surface`、`text-subtle`、`border-control`、`bg-brand-soft` 等名称。shadcn 兼容别名（`background`、`foreground`、`primary`、`popover`、`muted`、`destructive` 等）映射到同一组值。
3. **工具层**：字体、圆角、阴影、容器和动效以 Tailwind token 暴露（`text-body`、`rounded-lg`、`shadow-dialog`、`max-w-chat`）。

组件里不要使用裸十六进制、`text-[13px]` 或 `bg-black/30`。缺少数值时新增 token，不要新增任意类。

## 色板

外观由模式（系统、浅色、深色）和色板两个维度组成。每套色板都通过 `light-dark()` 分别适配明暗；模式由 `.dark` 类和 `color-scheme` 控制。

| 色板 | 画布 | 表面 | 品牌 | 品牌文字 |
|---|---|---|---|---|
| 暖砂（默认） | `#f7f6f3` / `#141413` | `#fbfaf8` / `#1b1a18` | `#b45309` / `#e88a4b` | `#94400a` / `#f2a973` |
| 石墨 | `#f6f7f8` / `#101315` | `#fbfcfd` / `#171b1e` | `#2f6fbf` / `#6aa9ef` | `#1b5399` / `#9cc9f7` |
| 潮青 | `#f5f7f6` / `#0f1413` | `#fafcfb` / `#161c1a` | `#0f6f6a` / `#4fb8b0` | `#0a514d` / `#8bd6cf` |
| 纸墨 | `#f7f7f7` / `#111111` | `#fcfcfc` / `#181818` | `#2a2a2a` / `#f0f0f0` | `#1a1a1a` / `#ffffff` |

规则：

- 主操作使用 `primary`（浅色近黑，深色近白），不使用品牌色。
- 品牌色表示身份、活动状态和焦点环。`brand-ink` 是可用于文字的品牌色。
- 成功、警告、危险色在各色板之间共用。
- 终端在所有色板中保持深色，由 `--term-bg`、`--term-fg`、`--term-selection` 控制。

### 新增或修改色板

1. 在 `styles.css` 中新增 `[data-palette="id"]` 块，包含全部 token：canvas、surface 1–3、fg、subtle、faint、border、border-strong、control、brand、brand-ink、brand-soft、brand-fg、success、warning、danger。
2. 校验对比度：正文和 11–12 px 标签 4.5:1；图标和控件边界 3:1。明暗两种模式都要检查。
3. 把 id 加入 `internal/settings/settings.go` 的 `settings.Palette` 和 `Valid()`，以及 `frontend/src/lib/types.ts` 的 `PALETTES`/`Palette`。不要改 `frontend/src/mygo.ts`，它是生成文件，色板 id 保持 `string`。
4. 在 `frontend/src/lib/i18n.ts` 增加中文名，并更新 mock 设置。
5. 在 `SettingsDialog.tsx` 的 `PALETTES` 中增加预览项；卡片通过 `data-palette` 渲染该色板自己的 token。
6. 运行 `bun run check:web`、`go test ./internal/settings/`；schema 变化时补迁移测试。

## 字体

| Token | 字号 | 行高 | 用途 |
|---|---|---|---|
| `text-micro` | 11 px | 1.45 | 大写标签、元数据、计数、键帽 |
| `text-label` | 12 px | 1.45 | 按钮、表单标签、紧凑列表 |
| `text-body` | 13.5 px | 1.7 | Markdown、输入框、会话正文 |
| `text-body-lg` | 14 px | 1.6 | 对话框标题、消息容器 |
| `text-title` | 16 px | 1.35 | 页面或卡片标题 |
| `text-heading` | 20 px | 1.25 | 区块标题 |
| `text-display` | 30 px | 1.15 | 空状态主标题 |

桌面端正文有意低于网页 16 px 基线。不要再缩小：11 px 是下限，这个尺寸的标签仍需 4.5:1 对比度。代码字号使用 `--code-font-size`，由设置中的代码字号控制。Markdown 表格使用 `text-label`。

`cn` 从 `frontend/src/lib/cn-tables.ts` 识别这些自定义字号；修改 `--text-*` token 后运行 `bun run cn:build`，字号与文字颜色类才能继续正确合并。

## 间距、圆角、阴影、动效

- 间距遵循 Tailwind 的 4 px 体系。常用节奏：2、6、8、12、16、24。
- 圆角：`xs` 4、`sm` 6、`md` 8、`lg` 10、`xl` 12、`2xl` 16。控件用 `md`；卡片和对话框用 `lg`/`xl`。
- 阴影只有 `shadow-popover`、`shadow-dialog`、`shadow-float`。浮层从中选择，不用其他阴影。
- 只有一个遮罩 `--scrim`，由 `DialogOverlay` 和窄窗浮层使用。
- 动效：快速 120 ms、基础 160 ms、慢速 200 ms，ease-out。遵守 `prefers-reduced-motion`。除流式光标和 `pulse-soft` 状态点外，不做持续动画。

## 组件

| 组件 | 位置 | 说明 |
|---|---|---|
| `Button` | `components/ui/button.tsx` | 变体：primary、secondary、outline、ghost、brand、destructive、quiet。尺寸：xs、sm、md、lg、icon、icon-xs、icon-sm、icon-lg。 |
| `DialogSurface` / `DialogHeader` | `components/ui/dialog-shell.tsx` | 宽度 440、600、720、900。共用边框、标题栏、关闭按钮、正文和底部节奏。 |
| `DialogOverlay` | `components/ui/dialog-shell.tsx` | 唯一的遮罩实现。 |
| `Field`、`TextInput`、`Textarea` | `components/ui/field.tsx` | 通过 `htmlFor` 关联标签，控件边界 3:1，品牌色焦点。 |
| `Select` | `components/ui/select.tsx` | Base UI 单选下拉。不要使用原生 `<select>`。 |
| `Combobox` | `components/ui/combobox.tsx` | Base UI 可搜索单选下拉。弹窗支持侧栏。 |
| `Checkbox` | `components/ui/checkbox.tsx` | Base UI 复选框。不要使用原生 `type="checkbox"`。 |
| `Tooltip` | `components/ui/tooltip.tsx` | Base UI 工具提示，共用延迟和弹窗表面。不要使用原生 `title=`。 |
| `Popover` | `components/ui/popover.tsx` | Base UI 浮层，用于可交互面板；从触发器定位，共用弹窗表面。 |
| `SectionLabel` | `components/ui/section-label.tsx` | 11 px 大写分组标签。 |
| `Kbd` | `components/ui/kbd.tsx` | 统一边框和尺寸的键帽。 |
| `StatusPill` | `components/ui/status-pill.tsx` | 色调：neutral、ready、brand、success、warning、danger、faint。 |
| `Message`、`Bubble`、`Marker`、`Trace` | `components/ui/` | 会话记录原语。 |
| `Toast` | `components/ui/toast.tsx` | 使用 popover 表面和 popover 阴影。 |

不要使用原生浏览器 UI：`title=` 工具提示、原生 `<select>`、原生复选框，或 `window.confirm`/`alert`/`prompt`。改用 `components/ui/` 中的 Base UI 封装。

工具卡、diff、审批坞、扩展状态栏、更改面板和输入框等产品专用表面使用同一套 token，但保留自己的布局。

## 无障碍规则

- 正文和标签在实际背景上达到 4.5:1，包括带色调的状态胶囊和活动行。
- 大字、图标和控件边界达到 3:1。
- 不只用颜色表达状态；圆点和底色必须配文字。
- 每个控件都有可访问名称。输入框使用 `htmlFor` 或 `aria-label`。
- 单选按钮暴露 `aria-pressed`。
- 全局焦点：2 px `--focus-ring` 外框，偏移 2 px。不要移除。
- 优先使用带文字的控件；纯图标按钮必须有 `aria-label` 和共享工具提示。

## 响应式行为

- 900 px 以下：侧栏变为带遮罩的固定浮层。选择项目、会话或设置后自动关闭。
- 1100 px 以下：右侧面板变为带遮罩的固定 sheet。
- 对话框宽度使用 `calc(100vw - 48px)`，任何界面缩放下都不会超出窗口。

## 验证

- `bun run check:web`：格式、lint、类型检查。
- `go test ./internal/settings/ ./internal/app/`：色板持久化与迁移。
- 视觉检查：每套色板的明暗模式、11 px 标签、焦点环、窄窗浮层。见[测试](testing.zh.md)。

## 相关

- [UX 与视觉方向](ux.zh.md)
- [功能实现](features.zh.md)
- [测试](testing.zh.md)
