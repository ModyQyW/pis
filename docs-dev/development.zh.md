# 本地开发

[English](development.md) | 简体中文

## 环境

- Go 1.27.3 或更新版本。
- Bun 1.4.5。
- 一个可用的 pi，用于真实会话测试。
- macOS 是主要开发和运行时验证平台。

```sh
git clone https://github.com/ModyQyW/pis.git
cd pis
bun install
```

`bun install` 会安装 Vite+ 的提交 hook。hook 在提交时运行 `./scripts/check.sh`。

Vite+ 是项目依赖。不得全局安装 `vp`。

## 启动应用

```sh
bun run dev
```

`mygo dev` 启动应用窗口和 Vite 热更新。

只调试 Web UI：

```sh
bun run dev:web
```

打开 `http://localhost:5173`。浏览器模式使用 mock 数据和 mock 聊天流，不连接 pi。

## 常用命令

| 命令 | 作用 |
|---|---|
| `bun run dev` | 应用窗口和热更新 |
| `bun run dev:web` | 只启动 Vite |
| `bun run format` | `go fmt` 和 Vite+ 格式化 |
| `bun run check` | 运行完整检查门禁 |
| `bun run check:web` | Vite+ 格式、lint、类型检查 |
| `bun run test` | 前端 Vitest |
| `bun run test:bridge` | bridge Bun 测试 |
| `bun run build` | 构建本机应用 |
| `bun run build:web` | 只构建前端 |
| `bun run generate` | 生成 `frontend/src/mygo.ts` |
| `bun run docs:dev` | 启动用户文档站 |
| `bun run docs:build` | 构建用户文档站 |
| `bun run docs:preview` | 预览用户文档站 |

完整门禁 `scripts/check.sh` 包含：

1. Go 格式检查。范围是 Git 跟踪的 Go 文件。
2. Go build、vet、test。范围排除 `node_modules` 中的 Go 包。
3. Vite+ 格式、lint、类型检查。
4. bridge Bun 测试。
5. 前端 Vitest。
6. 生产前端构建。
7. 用户文档构建。

提交前运行：

```sh
bun run format
bun run check
```

不得绕过失败的格式、lint、类型或测试检查。

## 开发环境变量

以下变量用于开发和调试：

| 变量 | 作用 |
|---|---|
| `PIS_PI` | 指定 pi 可执行文件。正常启动也生效 |
| `PIS_OPEN` | 开发模式下启动时打开项目 |
| `PIS_OPEN_SESSION` | 开发模式下打开指定会话文件 |
| `PIS_DEV_PROMPT` | 开发模式下会话打开后自动发送一条 prompt |
| `PIS_GUARD_OVERRIDE` | 开发模式强制审批策略：`off`、`smart`、`ask`、`allow` |
| `PIS_INTEGRATION` | 设为 `1` 时运行真实 pi 集成测试 |

除 `PIS_PI` 和测试变量外，其余变量只在开发模式生效。不得把这些变量写进用户指南。

## 修改 Go 服务

Go 服务的导出方法会被绑定到页面。

新增方法时：

1. 在服务结构体上添加导出方法。
2. 运行 `bun run generate`。
3. 在 `frontend/src/lib/api.ts` 增加需要的包装。
4. 运行类型检查和测试。

注意事项：

- 每个导出方法都会成为渲染进程可调用的 IPC 方法。
- 不得为测试或内部使用导出方法。
- 参数来自页面时，按不可信输入校验。
- 路径参数要检查工作区边界和符号链接。
- 错误要带上下文，不得静默返回零值。

`frontend/src/mygo.ts` 是生成文件。不得手改。

## 修改设置

设置结构在 `internal/settings/settings.go`。

新增用户设置时：

1. 在 `Settings` 增加字段。
2. 在 `Defaults` 增加默认值。
3. 在 `merge` 增加校验或迁移。
4. 在 `app.Preferences` 增加可空字段。
5. 在 `SetPreferences` 应用字段。
6. 在 `frontend/src/components/SettingsDialog.tsx` 增加控件。
7. 如果设置影响样式，在 `App.tsx` 应用 CSS 变量或属性。
8. 运行 `bun run generate`。
9. 增加设置加载和迁移测试。

字段缺失时的默认值要明确。布尔字段无法区分「未设置」和 `false` 时，使用 schema 版本迁移。

当前版本在 `settings.Version`。版本 1 的文件没有 `sendOnEnter`，加载时保持 `true`；版本 2 的文件没有 `palette`，加载时保持默认的暖砂。

## 修改 bridge

bridge 源码在 `internal/bridge/bridge.ts`。

1. 修改源码。
2. 递增 `internal/bridge/bridge.go` 的 `Version`。
3. 运行 bridge 测试。
4. 用真实 pi 测试相关命令。

`Ensure` 会写入新文件并删除旧的 `pis-bridge-*` 文件。版本不变时，旧文件可能被复用。

bridge 只注册 `pis-*` 名称。不得注册通用工具名或命令名。

## 修改前端 API

`frontend/src/lib/api.ts` 是页面和 IPC 之间的包装。

- 浏览器模式使用 mock 数据。
- mock 数据只能在开发构建中加载。
- 新增 mock 分支时，必须加 `import.meta.env.DEV` 或 `MOCK` 守卫。
- 生产构建不能包含 mock 数据。

新增用户可见文字时，用 `t()`。在 `frontend/src/lib/i18n.ts` 增加中文键。不得在模块顶层调用 `t()`。渲染时调用。

## 调试

### 浏览器 UI

`bun run dev:web` 适合调试布局、样式和状态。mock 数据覆盖：

- 项目、会话和文件。
- 聊天流、代码块、Mermaid 和数学公式。
- 审批、信任、MCP、工作树和登录对话框。
- 设置修改，包括字号和发送键。

mock 数据不会发送真实模型请求。

### 真实 pi

`bun run dev` 使用真实 pi。测试时注意：

- pi 版本必须在 `1.6` 到 `2` 之间。
- 会话会写入 pi 的数据目录。
- 工具调用会真实执行。
- 测试项目不得包含重要数据。

### 真实 pi 集成测试

```sh
PIS_INTEGRATION=1 go test ./internal/agent -run TestStartAndInspectRealPi
```

这个测试会启动 pi，读取状态和命令列表。它不发送 prompt。详见[测试](./testing.zh.md)。

### 日志和错误

- 应用启动错误写到标准错误。
- pi 进程崩溃时，界面显示最后一段 stderr。
- 设置中的诊断包含路径和版本，不包含 prompt 或凭据。
- 不得在代码中打印 prompt、凭据或完整会话内容。

## 代码约定

- 不伪造工具结果、审批结果或会话状态。
- 不静默吞错误。错误必须带上下文，并到达用户或错误处理器。
- pi 的会话、凭据、模型和信任文件只读。用户操作除外：删除会话、写 `mcp.json`。
- 新增路径检查时解析符号链接。
- 新增会话文件读取时设置字节上限。
- 新增列表时考虑虚拟化或上限。
- 新增设置时实现对应 UI，否则删除设置。
- 删除代码时同时删除绑定和生成文件。
- 文档边界：用户指南只写用户行为，开发文档写设计和证据。

## 构建本地应用

```sh
bun run build
open "build/darwin-arm64/PiS.app"
```

本机构建是 ad-hoc 签名。首次打开可能需要 Gatekeeper 放行。

跨平台构建、签名、更新密钥和发布步骤见[构建、签名与发布](./release.zh.md)。

## 相关文档

- [架构与数据流](./architecture.zh.md)
- [功能实现](./features.zh.md)
- [测试](./testing.zh.md)
- [常见陷阱](./pitfalls.zh.md)
- [决策记录](./decisions.zh.md)
