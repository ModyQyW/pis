# PiS 开发文档

[English](README.md) | 简体中文

本目录说明 PiS 如何工作、如何开发、如何测试、如何发布。普通用户请读 [https://pis.modyqyw.top](https://pis.modyqyw.top) 的用户指南。

PiS 是 pi 的桌面外壳。它不实现模型调用，不保存凭据，不替换 pi 的数据。修改代码前先读[架构与数据流](architecture.zh.md)。

## 阅读顺序

第一次参与开发：

1. [架构与数据流](architecture.zh.md)：进程模型、事件流、数据所有权和安全边界。
2. [本地开发](development.zh.md)：环境、命令、目录、生成代码和调试。
3. [功能实现](features.zh.md)：每个功能的位置和工作方式。
4. [调研](research.zh.md)：测量事实、竞品和架构理由。
5. [UX 与视觉方向](ux.zh.md)：布局、视觉规则、组件和交互。
6. [设计体系](design-system.zh.md)：token、色板、字阶、组件和扩展步骤。
7. [测试](testing.zh.md)：测试分层、完整门禁、真实 pi 测试和手工检查。
8. [决策记录](decisions.zh.md)：已接受的取舍。改设计前先查这里。
9. [常见陷阱](pitfalls.zh.md)：已经踩过的坑和对应规则。

发布相关：

- [构建、签名与发布](release.zh.md)
- [文档站维护](docs-site.zh.md)

历史：

- [项目历史](history.zh.md)：从研究到交付的简短时间线。

## 快速开始

```sh
git clone https://github.com/ModyQyW/pis.git
cd pis
bun install
bun run dev
```

只调试 Web UI：

```sh
bun run dev:web
```

浏览器模式使用 mock 数据，不连接 pi。

提交前：

```sh
bun run format
bun run check
```

`check` 会运行 Go 格式、构建、vet、测试，Vite+ 格式、lint、类型检查，bridge 测试，前端测试，前端构建和文档构建。

## 仓库结构

```text
main.go                应用入口、窗口、菜单和 IPC 绑定
internal/
  agent/               pi RPC 进程、命令和事件
  app/                 项目、设置、会话和审批服务
  auth/                pty 登录
  bridge/              内置 pi 扩展
  files/               文件搜索和预览
  gitx/                Git 状态、diff、工作树
  guard/               其他 guard 扩展检测
  mcp/                 mcp.json 管理
  piconf/              pi 设置、模型、技能和包
  piinfo/              pi 检测和版本检查
  sessions/            会话 JSONL 读取
  settings/            应用设置
  shellpath/           登录 shell PATH
  trust/               项目信任
frontend/
  src/app/             根组件
  src/components/      界面组件
  src/store/           聊天状态
  src/lib/             API、类型、i18n、工具
  src/mygo.ts          由 mygo generate 生成
internal/bridge/       bridge 扩展源码和测试
docs-user/             用户指南，Rspress 站点，中英文
docs-dev/              开发文档，中英文
scripts/               检查和发布脚本
```

## 文档规则

- 用户页面放在 `docs-user/en/` 和 `docs-user/zh/`。每个页面都有两种语言。
- `docs-user/` 只写用户可见的行为。不得放架构、开发、发布或文档站部署说明。
- 开发页面放在 `docs-dev/`。每个指南有英文 `.md` 文件和中文 `.zh.md` 文件。
- 每个开发页面顶部放语言链接。
- 用户指南的截图放在 `docs-user/public/images/`。
- 开发页面可以用相对路径引用用户指南截图。
- 新增或移动用户页面时，更新 `docs-user/en/_nav.json`、`docs-user/zh/_nav.json` 和相关的 `_meta.json`。
- 用户页面链接使用站内路径，例如 `/guide/install`。Rspress 会为中文页面加 `/zh` 前缀。
- 移动页面前，先搜索整个仓库中的旧路径。
- 不建立 archive 目录。当前调研放在 `research.zh.md`，取舍放在 `decisions.zh.md`，时间线放在 `history.zh.md`。

## 相关文件

- `mygo.config.ts`：应用名称、slug、bundle ID、默认版本。
- `rspress.config.ts`：文档语言、站点 origin 和主题。
- `package.json`：开发、检查、构建和文档命令。
- `scripts/check.sh`：完整检查门禁。
- `scripts/release.sh`：发布流程。
