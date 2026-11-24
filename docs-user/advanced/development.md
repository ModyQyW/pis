# 本地开发

## 环境

- Go 1.27.3+
- Bun 1.4.5
- 一个可用的 pi（真实会话验证需要）

```sh
git clone https://github.com/ModyQyW/pis.git
cd pis
bun install
```

## 开发窗口

```sh
bun run dev
```

这会启动 mygo 开发窗口和 Vite 热更新。只调试浏览器 UI 时：

```sh
bun run dev:web
```

然后打开 `http://localhost:5173`。浏览器模式使用 mock 数据，不连接真实 pi。

## 验证

提交前先格式化，再运行完整检查：

```sh
bun run format
bun run check
```

`bun run format` 只做格式化：`go fmt ./...` 和 `vp fmt`。`bun run check`
（即 `./scripts/check.sh`）包含：

- Go 格式检查（`gofmt -l`）
- Go build / vet / test
- Vite+ 格式、lint、类型检查（`vp check --deny-warnings`）
- bridge Bun 测试
- 前端 Vitest
- 生产前端构建
- Rspress 用户文档构建

`bun install` 会运行 `vp config --no-agent`，在本仓库安装 Vite+ 的 Git
hook；提交时会自动运行 `./scripts/check.sh`。Vite+ 由 `vite-plus` 作为项目
依赖提供，不需要全局安装 `vp`。单独运行：

```sh
bun run check:web
go test ./...
bun run test
bun run build:web
```

真实 pi 集成测试是可选、会消耗模型调用的：

```sh
PIS_INTEGRATION=1 go test ./internal/agent -run TestStartAndInspectRealPi
```

## 项目结构

```text
main.go                 应用入口、窗口、菜单、IPC 绑定
mygo.config.ts          mygo 构建配置：名称、slug、bundle ID
rspress.config.ts       文档站配置
vite.config.ts          Vite+ 格式、lint、类型检查配置
tsconfig.json           根配置类型检查
internal/
  agent/                pi RPC 进程与事件
  app/                  项目、设置、会话、审批服务
  auth/                 pty 登录
  bridge/               内置 pi 扩展
  files/ gitx/ mcp/     文件、Git、MCP
  sessions/             JSONL 读取
frontend/               React UI
docs-user/              Rspress 文档内容
docs-dev/               研发文档与证据
scripts/                开发、验证、发布脚本
```

## 文档站

Rspress 配置在根目录，内容在 `docs-user/`：

```sh
bun run docs:dev
bun run docs:build
bun run docs:preview
```

构建输出 `docs-user-build/`，不会进入 Git。

## 代码约定

- 不在前端伪造工具或审批结果。
- 不静默吞错误；界面和日志都要有上下文。
- pi 的 session/auth/trust 文件只读，不重写。
- 新 UI 字符串要通过 `t()`；中英文键保持一致。
- 修改 bridge 源码时同步更新 `bridge.Version`，否则旧扩展文件会被复用。
- 提交前必须运行 `bun run format` 与 `bun run check`；不要绕过 Vite+ 的格式或 lint 失败。
- 配置和端口约定见 `docs-dev/01-decisions.md` 与 `docs-dev/04-pitfalls.md`。

下一步：[构建、签名与发布](/advanced/release)。

文档站部署见[部署文档站](/advanced/docs-deployment)。
