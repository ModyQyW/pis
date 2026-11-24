---
pageType: home
hero:
  name: PiS
  text: 强一点的桌面 Coding Agent
  tagline: 用你已有的 pi，把真实会话、工具、扩展和项目放进一个原生窗口。
  image:
    src: /images/empty.png
    alt: PiS 桌面窗口
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 看架构
      link: /advanced/architecture
features:
  - icon: 🧠
    title: 不替换 pi
    details: 直接运行你安装并登录的 pi，沿用现有模型、会话、技能、提示模板和扩展。
  - icon: ⚡
    title: 为长会话而做
    details: 流式 Markdown、虚拟化 transcript、快速 JSONL 首屏、工具卡片和变更面板。
  - icon: 🛡️
    title: 有边界的自动化
    details: 项目信任、Smart 审批、只读计划模式和退出保护；不把审批当沙箱。
  - icon: 🧩
    title: 扩展继续可用
    details: 现有 pi 扩展通过 RPC 加载；对话框、状态、widget 和工具卡片都有落点。
  - icon: 🪟
    title: 原生外壳
    details: Go + mygo 的系统 WebView、原生菜单、通知、Dock 与窗口行为。
  - icon: 🌏
    title: 中英双语
    details: 默认英文，可在设置中切换中文；代码、Markdown 和 CJK 排版都走同一套界面。
---

## PiS 是什么

PiS 是一个**桌面 Coding Agent 外壳**。它不重新实现模型调用，也不接管 pi 的数据：

```text
PiS 窗口
  └─ 你安装的 pi
       ├─ 你已有的模型和凭据
       ├─ 你已有的 session / skill / extension
       └─ 你已有的项目工具
```

PiS 负责把 pi 的 RPC 会话变成可读、可操作、可恢复的桌面体验。想先跑起来，读[安装与第一次运行](/guide/getting-started)；想理解为什么这样设计，读[架构与数据流](/advanced/architecture)。
