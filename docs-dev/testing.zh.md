# 测试

[English](testing.md) | 简体中文

PiS 的测试分为五层：前端单元测试、bridge 测试、Go 测试、真实 pi 测试和手工 QA。

完整门禁：

```sh
bun run check
```

只跑前端：

```sh
bun run test
bun run test:bridge
bun run check:web
```

## 测试分层

| 层 | 命令 | 覆盖 |
|---|---|---|
| 前端单元 | `bun run test` | 会话状态、transcript、i18n、问题卡片、待办、子代理 |
| bridge | `bun run test:bridge` | 审批规则、计划模式、路径检查 |
| Go 单元 | `go test ./internal/... .` | 设置、信任、会话、MCP、pi 配置、文件、Git、认证、进程 |
| 真实 pi | `PIS_INTEGRATION=1 ...` | RPC 启动、状态、命令、真实会话 |
| 手工 QA | `bun run dev` | 界面、工具、审批、布局和跨平台行为 |

`bun run check` 还运行：

- Go 格式检查。
- Go build 和 vet。
- Vite+ 格式、lint 和类型检查。
- 生产前端构建。
- 用户文档构建。

## 前端单元测试

配置在 `frontend/vitest.config.ts`。环境是 jsdom。测试文件位于 `frontend/src/**/*.test.ts`。

现有测试覆盖：

- `store/chat.test.ts`：发送失败恢复草稿、关闭启动中的会话、关闭后事件丢弃、对话框取消。
- `lib/transcript.test.ts`：工具调用配对、孤立工具结果、实时块、压缩条目、扩展消息。
- `lib/i18n.test.ts`：翻译回退和插值。
- `lib/questions.test.ts`：问题参数解析和答案匹配。
- `lib/todos.test.ts`：待办状态提取。
- `lib/subagents.test.ts`：子代理调用和结果配对。

新增测试时：

- 在行为边界测试，不只测试实现。
- 用 mock 隔离 IPC。
- 测试失败路径和数据丢失路径。
- 新测试必须在行为破坏时失败。

组件没有完整的 DOM 测试框架。交互较多的界面用浏览器手工检查。

## bridge 测试

文件：`internal/bridge/bridge.test.ts`。

使用 Bun 测试和假的 `ExtensionAPI`。覆盖：

- 破坏性命令会触发审批。
- 计划模式阻止 `mkdir` 和 `git push`。
- `../` 和 `$HOME` 路径会触发工作区检查。
- 敏感文件会触发审批，例如 `.env`、SSH 私钥和 `auth.json`。

bridge 运行在 pi 进程中。测试必须使用假的 `pi` 对象，不能加载真实 pi。

## Go 测试

按包运行：

```sh
go test ./internal/...
```

主要覆盖：

- `app`：项目路径规范化和最近项目去重。
- `auth`：pty 输入、输出和退出。
- `files`：文件排序、符号链接边界。
- `gitx`：状态解析、重命名统计、diff、还原、工作树生命周期、脏工作树移除。
- `mcp`：合并、覆盖、添加、启用、删除、未知字段保留、重名拒绝。
- `piconf`：pi 设置和提供商读取、密钥脱敏、原子写入、未知字段保留、技能发现、损坏文件的写入拒绝。
- `piinfo`：版本解析、支持范围、路径发现。
- `sessions`：活动分支、嵌套子代理排除、搜索、摘要缓存刷新。
- `settings`：默认值、损坏文件、迁移、校验、快照隔离。
- `trust`：资源检测、祖先 `.agents/skills`、用户全局技能排除、pi 信任记录。
- `agent`：增量合并、记录读取上限。

Git 测试需要本机安装 `git`。没有 Git 时，测试会跳过。

## 真实 pi 测试

启动并检查真实 pi：

```sh
PIS_INTEGRATION=1 go test ./internal/agent -run TestStartAndInspectRealPi
```

这个测试会启动真实 pi 进程，读取状态和命令列表，然后关闭会话。当前测试不发送 prompt，不消耗模型调用。

真实会话读取：

```sh
PIS_SESSION_FILE=/path/to/session.jsonl go test ./internal/sessions -run TestReadRealSession -v
PIS_WORKSPACE=/path/to/project go test ./internal/sessions -run TestListRealWorkspace -v
```

这些测试只读取文件，不修改会话。

## 手工 QA

在真实 pi 和真实项目中检查：

- 安装和首次启动。
- pi 路径检测和版本提示。
- 提供商登录。
- 新会话、恢复、重命名、分叉、克隆、会话树。
- 流式文本、思考块、代码块、Mermaid、数学公式和图片。
- 工具卡片：shell、read、edit、write、grep、find、ls、todo、子代理。
- 审批：允许一次、会话内允许、拒绝。
- 计划模式：只读工具和修改拦截。
- 项目信任：拒绝、允许、重启会话。
- 更改面板：diff、复制 patch、还原、文件预览。
- pi 配置标签：显示当前默认值、提供商、技能、扩展、包、MCP 和 pi 文件路径。编辑直接写入 pi 的文件；已保存密钥保持隐藏。启动对话框仍会确认变化后的配置。
- 对话：行内删除单个对话，多选批量删除；两者都把文件移到废纸篓。
- MCP：添加、启用、删除、重载会话。
- 工作树：创建、打开、移除、脏工作树二次确认。
- 扩展对话框、状态和 widget。
- 设置：主题模式、四套色板、语言、字号、发送键、通知。
- 刷新期间刷新图标旋转。纯图标按钮显示提示。
- 退出保护：运行中退出提示。
- 更新检查和 Gatekeeper 流程。

平台检查：

- macOS arm64 是主要验证平台。
- Windows 和 Linux 构建需要在实际机器上补做运行时检查。

## 浏览器检查

只修改前端时，使用浏览器模式：

```sh
bun run dev:web
```

重点检查：

1. 设置面板的文字与输入区域。
2. 代码字号影响 Markdown 代码块、diff、工具输出和预览。
3. 界面缩放后，对话框仍在窗口内。
4. 关闭「按 Enter 发送」后，Enter 换行，`⌘Enter` 发送。
5. 每套色板的暗色和亮色模式。
6. 焦点环可见，正文和标签保持 4.5:1 对比度下限。
7. 窗口宽度 900 px 及以下时，侧栏带遮罩浮层显示，选择后自动关闭；1100 px 及以下时，右侧面板变为 sheet。
8. 中文界面没有明显的英文残留。

浏览器模式使用 mock 数据，不能代替真实 pi 测试。

## 验证记录

最近一次完整 macOS arm64 验证：2026-11-22 到 2026-11-24。

| 范围 | 结果 |
|---|---|
| Go build、vet、测试 | 通过 |
| Vite+ 格式、lint、类型检查 | 通过 |
| 前端测试 | 通过 |
| 生产前端构建 | 通过 |
| 文档构建 | 通过，中英文共 32 页 |
| 暖启动窗口 | 三次中位数 0.422 s |
| 空闲占用 | 无 pi 会话时 42 MB 物理内存 |
| 真实会话记录 | 246 条，13 ms |
| 1,000 条消息夹具 | 3.5 ms |
| 18 个会话列表 | 56 ms |
| 真实 pi 启动 | 2.06 s，包含已安装包 |
| 真实流式 prompt | 通过 |
| 真实计划模式 | 通过；修改类工具被阻止 |
| 真实 Smart 审批 | 通过；`rm -rf` 询问，拒绝后阻止 |
| 真实信任流程 | 通过；信任后加载本地扩展 |
| 登录 pty | 通过；提示、输入、回显、退出 |
| 更改、diff、会话树、搜索 | 通过 |
| 0.0.5 arm64 DMG | 7.2 MB |
| 0.0.6 arm64 DMG | 7.2 MB |
| 0.0.7 arm64 DMG | 7.2 MB |
| 0.0.8 arm64 DMG | 7.3 MB |
| 0.0.9 arm64 DMG | 7.3 MB |

这些数字是历史结果，对应上述机器和构建。发布前重新运行门禁和相关手工检查。

平台缺口：

- Windows 和 Linux 运行时 QA：跳过。没有本地机器。
- macOS amd64 运行时 QA：跳过。本地主机是 arm64。
- 打包后的 WKWebView 界面：只做手工检查。

## 性能检查

性能预算见 ADR-013。最近测量结果见上方验证记录。

修改以下路径时重新测量：

- 会话首屏读取。
- 会话列表扫描。
- 命令面板搜索。
- 流式文本更新。
- 长时间会话的内存和滚动。

预算不是自动测试。手工测量时记录：

- 数据集大小。
- 机器和系统。
- 冷启动或热缓存。
- 测量命令。
- 结果。

## CI

`.github/workflows/ci.yml` 运行：

- Go 格式、构建、vet、测试。
- 六个目标的交叉编译。
- 前端格式、lint、类型检查、bridge 测试、Vitest、构建。
- 文档站构建。
- macOS 应用打包。

`.github/workflows/release.yml` 运行发布流程。它不会自动发布 draft。

## 已知缺口

- Windows 和 Linux 没有完整的运行时 QA。
- 打包后的 WKWebView 没有自动化界面测试。
- 更新安装路径需要手工验证。
- 组件级 DOM 测试尚未建立。

发现缺口时，在 pull request 和发布检查清单中记录检查范围和结果。

## 相关文档

- [本地开发](./development.zh.md)
- [架构与数据流](./architecture.zh.md)
- [功能实现](./features.zh.md)
- [发布](./release.zh.md)
