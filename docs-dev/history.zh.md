# 项目历史

[English](history.md) | 简体中文

本页简短记录 PiS 如何构建。测量事实见[调研](research.zh.md)。已接受的取舍见[决策记录](decisions.zh.md)。

## 起点

PiS 起初是 mygo 上的 pi 桌面外壳。目标是小型原生窗口、丰富的会话记录、真实 pi 会话、审批、计划模式、扩展和发布流程。

项目不是第二个 agent runtime。它不捆绑 pi，不保存凭据，不替换 pi 数据。

## 调研

调研比较了 mygo、pi 的 RPC 与 SDK 路径，以及五个已有 pi 客户端。原型覆盖 RPC 会话、扩展 UI、项目信任、243 条消息的恢复会话、pty 登录和 mygo hello 构建。

主要发现：

- RPC 复用真实 pi 扩展，并隔离崩溃。
- SDK 需要重新实现加载器、认证和扩展 UI bridge。
- JSONL 首屏比等待 `get_messages` 快。
- RPC 不能显示 pi 的项目信任提示，所以应用必须自己询问。
- pi RPC 的 UI 子集是真实限制；PiS 必须说明，不得伪造。

测量和竞品教训见[调研](research.zh.md)。

## 决策

[决策记录](decisions.zh.md)保存已接受的 ADR。主要选择：

- 用 RPC，不用 SDK。
- 每个打开会话一个 pi 进程。
- 启动前由应用询问项目信任。
- JSONL 首屏；pi 是权威。
- 只传增量，16 ms 合并。
- 内置 `pis-*` bridge。
- 会话、凭据、模型和信任归 pi。
- 小型设置文件和系统 WebView。

## 计划与构建

V1 计划确定范围、文件布局、阶段、测试策略和验证命令。构建从 Go/React 外壳推进到真实 pi 会话、流式 Markdown、工具卡片、审批、计划模式、更改、工作树、搜索、扩展、本地化和打包。

[功能实现](features.zh.md)把结果对应到当前代码。[测试](testing.zh.md)列出验证矩阵和测量结果。

## 质量与设计

每条风险路径都有测试或手工检查：会话解析、流式输出、审批、信任、计划模式、文件边界、MCP 写入、设置迁移和进程清理。

[UX 与视觉方向](ux.zh.md)记录布局、视觉系统、组件、会话记录、输入框、对话框、状态、键盘、空状态和错误状态。

## 发布

| 版本 | 状态 |
|---|---|
| `0.0.1` | 首次公开发布 macOS、Windows 和 Linux 版本 |
| `0.0.2` | 用户指南、配置类型检查、发布版本提示 |
| `0.0.3` | 未发布；Vite+ 门禁、图标、文档拆分、Smart 审批修复 |
| `0.0.4` | 公开发布 0.0.3 源码；删除 Netlify 配置 |
| `0.0.5` | 手动检查更新、pi 路径唯一来源、登录 shell PATH、一键发布脚本 |
| `0.0.6` | 中英文指南和界面、会话与文件加固、CHANGELOG 驱动的发布 |
| `0.0.7` | 色板与共享设计体系、Release 下载指引、不再发布 delta |
| `0.0.8` | pi 配置对话框、技能指南、扩展兼容说明、MCP 与配置加固 |
| `0.0.9` | pi 配置标签、对话删除、Release 资产链接、刷新与提示 |
| `0.0.10` | 可搜索的设置分区、共享 Select/Combobox/Checkbox、按提供商过滤的模型选择器、更安静的思考行、可折叠工具输出 |

`0.0.3` 有 tag，但没有发布为 GitHub Release。`0.0.10` 是当前公开版本和 latest。

## 当前状态

- macOS arm64 是主要运行时验证平台。
- Windows 和 Linux 产物可以构建，但运行时 QA 不完整。
- macOS 使用 ad-hoc 签名，未 notarize。
- Windows 使用未签名安装器。
- 更新使用 GitHub Releases 和 Ed25519 密钥。
- 文档站在 `https://pis.modyqyw.top`。
- 用户指南和开发指南有中英文版本。CHANGELOG 有中英文版本。

## 相关

- [调研](research.zh.md)
- [决策记录](decisions.zh.md)
- [常见陷阱](pitfalls.zh.md)
- [发布](release.zh.md)
