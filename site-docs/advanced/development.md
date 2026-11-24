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

```sh
./scripts/verify.sh
```

包含：

- Go build / vet / test
- 前端类型检查
- 根目录 TypeScript 配置检查
- 前端 Vitest
- 生产前端构建

单独运行：

```sh
go test ./...
bun run typecheck
bun run typecheck:config
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
tsconfig.json           根配置类型检查
internal/
  agent/                pi RPC 进程与事件
  app/                  项目、设置、会话、审批服务
  auth/                 pty 登录
  bridge/               内置 pi 扩展
  files/ gitx/ mcp/     文件、Git、MCP
  sessions/             JSONL 读取
frontend/               React UI
site-docs/              Rspress 文档内容
docs/                   研发文档与证据
scripts/                开发、验证、发布脚本
```

## 文档站

Rspress 配置在根目录，内容在 `site-docs/`：

```sh
bun run docs:dev
bun run docs:build
bun run docs:preview
```

构建输出 `site-build/`，不会进入 Git。

## 代码约定

- 不在前端伪造工具或审批结果。
- 不静默吞错误；界面和日志都要有上下文。
- pi 的 session/auth/trust 文件只读，不重写。
- 新 UI 字符串要通过 `t()`；中英文键保持一致。
- 修改 bridge 源码时同步更新 `bridge.Version`，否则旧扩展文件会被复用。
- 配置和端口约定见 `docs/01-decisions.md` 与 `docs/04-pitfalls.md`。

下一步：[构建、签名与发布](/advanced/release)。
