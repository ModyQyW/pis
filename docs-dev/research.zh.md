# 调研

[English](research.md) | 简体中文

本页记录 PiS 架构背后的调研和仍然影响决策的测量结果。它取代原始调研记录。已接受的决策见[决策记录](decisions.zh.md)。

## 范围和方式

调研日期：2026-11-22。检查了：

- `egoist/mygo` 的 `41f31d5`：带系统 WebView 和 typed Go/TS IPC 的 Go 桌面框架。
- `earendil-works/pi` 的 `9c46526`：agent、CLI、RPC、SDK、扩展和包。
- `JetBrains/thinkrail`、`vastsa/PI-Desktop`、`abcwyc/pi-agent-desktop` 和 `bytesbay/pi-gpui`：pi 的桌面客户端。
- 本机 pi 1.6.0 和 `~/.pi/agent` 配置。

实际原型：

1. 用自定义扩展运行 `pi --mode rpc`：会话事件、扩展 UI、权限阻止和斜杠命令。
2. 在带本地扩展的项目中运行 `pi --mode rpc --approve`。
3. 通过 RPC 恢复 243 条消息、566 KB 的会话。
4. 在 pty 中运行 `pi auth login`。
5. 构建并运行 mygo hello 二进制，测量大小和空闲占用。

## mygo

事实：

- 单个 Go 二进制。系统 WebView。不捆绑浏览器引擎，不使用 cgo。
- Typed IPC：绑定 Go 服务，TypeScript 调用，事件按主循环批次发送。
- 前端资源嵌入二进制。应用从自己的 origin 提供页面。
- 原生窗口支持隐藏式 inset 标题栏、红绿灯位置、vibrancy、背景色和窗口状态。
- 桌面 API 包括菜单、对话框、通知、`Shell.OpenPath`、`Shell.TrashItem`、文件监听和单实例锁。

测量：

| 测量项 | 结果 |
|---|---|
| `examples/hello` release 二进制 | 9.5 MB |
| 空闲物理占用 | 应用进程 33 MB |
| 前端加载 | 嵌入资源，本地 origin |
| 空闲 CPU | 稳定后 0% |

限制：

- 可信页面必须留在应用 origin。不得在其中渲染第三方 HTML。
- 从 Finder 打开的 macOS 应用只有最小 `PATH`。PiS 必须自己找到 pi 和 node。
- WKWebView 有辅助进程。总内存包含它们。
- mygo 只提供窗口状态，应用状态由 PiS 管理。

意义：外壳可以小且快。重的是 pi 和模型提供商。WebView 提供 Markdown、代码高亮、虚拟列表和无障碍对话框，不需要捆绑 Chromium。

## pi 和 RPC

事实：

- pi 提供 agent 循环、模型、内置工具、会话、压缩、重试、MCP、codemode 和扩展。
- 扩展从用户目录、项目目录、包或 `-e` 加载。扩展可以注册工具、命令、事件钩子、TUI 组件和 `ctx.ui` 提示。
- RPC 是 stdin/stdout 上的长连接 JSONL 协议。支持 prompt、steer、follow-up、abort、模型和思考选择、压缩、重试、会话切换、分叉、克隆、树读取、命令、统计和导出。
- 独立 pi 二进制约 103 MB，运行时不依赖 Node。
- 会话文件是追加式 JSONL 树。子代理运行在嵌套目录中。
- RPC 不能显示 pi 内置的项目信任提示。没有 `--approve` 或已保存的信任决定时，项目资源不加载。
- RPC 扩展 UI 支持 `select`、`confirm`、`input`、`editor`、`notify`、`setStatus`、`setWidget`、`setTitle` 和 `set_editor_text`。不支持 `ctx.ui.custom()`、终端输入、自定义编辑器和主题切换。
- pi 没有内置权限系统。扩展可以拦截 `tool_call`，通过 `ctx.ui` 询问。
- `pi auth login <provider>` 需要终端。pty 可用。

| | RPC | TypeScript SDK |
|---|---|---|
| 扩展兼容 | 真实 pi 进程和加载顺序 | 宿主必须复刻加载器和 UI bridge |
| 崩溃隔离 | pi 崩溃不杀应用 | 扩展崩溃可能杀宿主 |
| 语言 | JSONL，Go 可用 | 需要 TypeScript 宿主 |
| 版本耦合 | pi 1.x 内稳定 | 内部 SDK 类型变化更频繁 |
| 扩展 UI | 文档化的 RPC 子集 | 宿主专用 bridge |
| 会话和认证 | pi 拥有 | 相同，但宿主接线更多 |

RPC 是唯一不重写 pi 加载器、包管理器、认证和会话机制的路径。代价是文档化的 UI 子集。PiS 明确说明这个限制，不伪造 TUI 组件。

测量：243 条消息的会话调用 `get_messages` 约 1.5 s，返回 566 KB。因此首屏直接读 JSONL，并并行启动 pi。

## 竞品

| 客户端 | 优势 | 教训 |
|---|---|---|
| pi-gpui | 架构最接近：每个会话一个 `pi --mode rpc`，JSONL 会话，小二进制 | 复制原则和性能纪律，不复制原生 GPUI 栈 |
| pi-agent-desktop | 日常功能广；读取已有 pi 数据 | 用功能清单做对照；不分叉 Web 应用，不捆绑 Node 服务 |
| ThinkRail | IDE 功能深，规格、子代理、工作树 | 取高杠杆功能；不要变成 IDE |
| PI-Desktop | 权限、计划批准、恢复、大量 ADR | 把 ADR 当边界情况清单，不当范围模板 |
| pi-web | 成熟的 pi 浏览器 UI | 桌面外壳可以在启动、原生集成和更安静的 UI 上取胜 |

## 架构选择

调研导致以下选择。细节见[架构与数据流](architecture.zh.md)和[决策记录](decisions.zh.md)。

1. 用 RPC，不用 SDK。
2. 每个打开会话一个 pi 进程。
3. 在应用里询问项目信任，同意后才传 `--approve`。
4. 首屏读 JSONL；pi 仍是权威。
5. 只传增量，16 ms 合并。
6. 内置 bridge 负责会话树、计划模式、审批和状态。
7. 应用内不跑 HTTP 服务；使用 typed IPC 和应用 origin。
8. 会话、凭据、模型和信任归 pi。

## 差异化

PiS 目标是快速、安静、原生感的桌面客户端，具有真实 pi 扩展兼容、强流式输出和工具渲染，以及安全的默认信任和审批模型。目标不是 IDE 功能对齐或插件平台广度。

## 风险

| 风险 | 缓解 |
|---|---|
| RPC UI 子集破坏扩展 | 支持全部 RPC 方法；说明 TUI 专属功能；用已安装扩展测试 |
| 扩展噪声淹没 UI | 合并、去 ANSI、限制状态数、widget 默认关闭 |
| 信任静默禁用项目资源 | 应用内对话框，同意后才 `--approve`，测试祖先技能 |
| 恢复阻塞首屏 | 先读 JSONL；并行启动 pi |
| 流式输出 O(n²) | 只传增量事件，16 ms 合并 |
| 长会话内存过高 | 虚拟会话记录和有上限的读取 |
| Finder `PATH` 找不到 pi | 读取登录 shell PATH，并支持显式路径 |
| 版本漂移 | RPC、测试过的范围、特性检测、清晰诊断 |
| 双重审批提示 | 检测其他 guard；PiS guard 可选 |
| 认证终端泄漏密钥 | 不记录 pty 输出；只留在内存 |

## 事实与推断

事实：仓库内容、文档化 API、启动、载荷、二进制和内存测量、可复现的信任行为、审批和 pty 登录。

推断：用户偏好安静 UI、内置计划模式的价值、最终内存和前端速度。它们由[测试](testing.zh.md)和性能预算验证。

## 相关

- [架构与数据流](architecture.zh.md)
- [决策记录](decisions.zh.md)
- [功能实现](features.zh.md)
- [测试](testing.zh.md)
