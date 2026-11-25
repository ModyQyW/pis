---
pageType: home
hero:
  name: PiS
  text: 桌面 Coding Agent 外壳
  tagline: 用你已有的 pi，在原生窗口里处理项目、会话、工具和扩展。
  image:
    src: /images/empty.png
    alt: PiS 桌面窗口
  actions:
    - theme: brand
      text: 安装 PiS
      link: /zh/guide/install
    - theme: alt
      text: 了解界面
      link: /zh/guide/interface
features:
  - title: 使用你已有的 pi
    details: PiS 运行你安装并登录的 pi，沿用现有模型、凭据、会话、技能、提示模板和扩展。
  - title: 长会话可用
    details: 流式 Markdown、虚拟化会话列表、快速首屏、工具卡片、变更面板和会话树。
  - title: 有边界的自动化
    details: 项目信任、Smart 审批、只读计划模式和退出保护。需要强隔离时使用容器或虚拟机。
  - title: 现有扩展可用
    details: pi 扩展通过 RPC 加载。对话框、状态、widget 和工具结果都有显示位置。
---

## PiS 是什么

PiS 是一个桌面窗口，负责显示和操作 pi 的会话。

PiS 不包含模型，不保存凭据，也不替换 pi 的数据：

```text
PiS 窗口
  └─ 你安装的 pi
       ├─ 你的模型和凭据
       ├─ 你的会话、技能和扩展
       └─ 你的项目工具
```

## 开始使用

1. 安装 pi，并完成一次登录。参考 [pi 文档](https://pi.dev/docs/latest/quickstart)。
2. 安装 PiS。参考[安装与第一次运行](/zh/guide/install)。
3. 打开一个项目目录。
4. 在输入框里写目标，按 Enter 发送。

## 文档怎么读

- 第一次使用：读[安装与第一次运行](/zh/guide/install)和[窗口与界面](/zh/guide/interface)。
- 日常使用：读[项目](/zh/guide/projects)、[会话](/zh/guide/sessions)、[输入框](/zh/guide/composer)和[更改与文件](/zh/guide/changes)。
- 控制自动化：读[信任、审批与计划模式](/zh/guide/approvals)。
- 登录和模型：读[模型与登录](/zh/guide/models)。
- 遇到问题：读[故障排查](/zh/reference/troubleshooting)。

开发、发布和架构文档在仓库的 [`docs-dev/`](https://github.com/ModyQyW/pis/tree/main/docs-dev)。本手册只说明如何使用 PiS。
