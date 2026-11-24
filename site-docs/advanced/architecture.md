# 架构与数据流

PiS 不是另一个 agent runtime。它是一个围绕 pi RPC 的原生桌面外壳。

```text
┌──────────────────────────────────────────────┐
│ mygo 原生窗口（Go，系统 WebView）             │
│                                              │
│  React + Vite + Tailwind                     │
│  ├─ transcript / composer / panels           │
│  ├─ typed IPC services                       │
│  └─ 事件与状态                                 │
│                                              │
│  Go services                                 │
│  ├─ Desktop / Sessions / Files / Git / MCP   │
│  ├─ Auth（pty 登录）                          │
│  └─ Agent manager                            │
│        └─ 每个打开会话一个 pi --mode rpc      │
└──────────────────────────────────────────────┘
```

## 为什么是“原生壳 + Web UI”

PiS 需要 Markdown、代码高亮、Mermaid、KaTeX、虚拟化长列表、diff 和可访问对话框。Web 生态已经解决了这些问题；mygo 提供系统 WebView、原生菜单、通知和窗口行为，避免捆绑一整颗 Chromium。

代价是 WebView 的布局和性能需要单独验证，尤其是长 transcript、CJK 换行和流式更新。

## 会话生命周期

1. 用户打开项目。
2. Go 侧启动一个 `pi --mode rpc` 子进程。
3. 通过 stdin/stdout 发送 RPC 命令并读取事件流。
4. 事件进入 Go manager，合并增量后通过 mygo typed IPC 发给前端。
5. 前端把事件归约成 transcript、工具卡片、状态、widget 和审批 dock。
6. 用户关闭会话时终止对应 pi 进程；退出应用时统一清理子进程。

每个打开会话一个进程，避免多个会话共享上下文或互相阻塞。

## 首屏为什么快

PiS 不等待 pi 重建完整上下文才显示会话：

- 直接读取 pi 的 session JSONL 做首屏。
- 只解析需要的消息和元数据。
- 前端使用虚拟化列表，渲染窗口内的行。
- Markdown、代码语法、Mermaid、KaTeX 按需加载。
- 历史页面不写入 PiS 自己的副本。

pi 仍然是模型上下文的权威来源；PiS 的读取是展示层。

## 扩展桥

PiS 把少量 RPC 缺口放在一个内置 pi 扩展里：

```text
internal/bridge/bridge.ts
  → 写入应用数据目录
  → 以 -e 加载到每个 pi 进程
```

它只处理：

- 会话树导航
- 计划模式
- 可选审批
- 状态发布

扩展仍由 pi 执行，因此拥有与 pi 相同的系统权限。

## 安全模型

- 项目资源先经过信任对话框。
- 工具调用可以经过 Smart/Ask 审批。
- 计划模式限制修改类工具。
- 应用不保存 provider 凭据。
- 诊断不包含 prompt 或 session 内容。

这些是产品级保护，不是内核沙箱。需要强隔离时，把 pi 放进容器或受限账户。

## 技术栈

- Go 1.27.3+
- mygo 0.10.x
- React 19、Vite 8、Tailwind 4
- Base UI / shadcn 风格组件
- Streamdown code/mermaid/math 插件
- TanStack Virtual
- xterm.js（登录终端）

下一步：[本地开发](/advanced/development)。
