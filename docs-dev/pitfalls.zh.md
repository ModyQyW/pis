# 陷阱、错误与修正

[English](pitfalls.md) | 简体中文

这个文件用来避免重复踩同一个坑。每条记录说明发生了什么（或经检查证实的情况）、后果，以及防止再次发生的规则。

## RPC 与 pi

### P-001：RPC 项目信任没有 UI
**证据。** pi CLI 中的 `createProjectTrustContext` 传入
`hasUI: isInitialRuntime && trustPromptMode === "interactive"`。bridge 扩展的
`project_trust` 处理器看到 `hasUI: false`；没有弹出对话框，项目扩展一直没有加载。
**规则。** 在应用里检测信任，在应用里询问，只有用户同意后才传 `--approve`。不要依赖 RPC 中的 `project_trust` 扩展钩子。

### P-002：项目本地资源需要 `--approve`
**证据。** 不带 `--approve` 时，`get_commands` 没有列出本地扩展
`.pi/extensions/demo.ts`；带上 `--approve` 后就会列出。
**规则。** 信任是会话启动时的标志。改变信任状态必须重启会话进程。

### P-003：`ctx.ui.custom()` 在 RPC 中不可用
**证据。** pi 的 RPC 扩展 UI 文档写明：`custom()` 返回 `undefined`；
终端输入、自定义编辑器、主题和组件工厂都是空操作。
有些扩展退回到文本或选择框；`ask_user_question` 有 RPC 回退；`pi-subagents` 有一套可选的主机组件协议，我们没有实现。
**规则。** 实现我们能做的每个 RPC UI 原语；检测只在 TUI 中有效的行为并说明。绝不假装自定义组件已经渲染。

### P-004：扩展状态和 widget 流量很吵
**证据。** 安装 16 个包后启动，在第一次提示前发出约 20 个 UI 请求
（powerline widget、LSP 状态、子代理状态、goal、loop）。有些字符串包含 ANSI 转义和 TUI 边框字符。
**规则。** 去掉 ANSI，按 key 去重，限制可见标签数量，把完整状态放进抽屉，原始 TUI widget 需要显式开启（默认关闭）。不要把所有 `setWidget` 都内联渲染。

### P-005：JSONL 分帧不是 `readline`
**证据。** pi 文档指出：只能按 LF 拆分；U+2028 和 U+2029 在 JSON 字符串里合法，而 Node 的 `readline` 会把它们当换行。
**规则。** 读取字节直到 `\n`，去掉可选的 `\r`，再解析。写命令时，如果写入端按行处理，要转义 U+2028/U+2029（我们写 JSON 行；Go 编码器默认会转义，但要测试）。

### P-006：stdout 背压会卡住 pi
**证据。** pi 文档指出：客户端停止读取会让进程卡住。
**规则。** 单独的读取 goroutine，有界队列，增量合并，不阻塞 mygo 主线程。

### P-007：关闭不是 `kill`
**证据。** pi 文档指出：关闭 stdin 会开始有序关闭；SIGTERM/SIGHUP 也一样；第二个信号会立即退出。扩展可能需要时间。
**规则。** 关闭 stdin，等约 3 秒，再 kill。退出事件要带上 stderr 尾部。没有用户意图时，绝不静默杀掉正在运行的轮次。

### P-008：一个会话，一个写入者
**证据。** pi 不阻止两个进程打开同一个会话文件。pi-gpui 用 lease 文件，终端版 pi 没有。
**规则。** 应用内一个会话最多打开一次；在会话文件旁（或应用状态里）写一个 lease，发现外部 lease 就拒绝或警告。绝不静默地跑两个写入者。

### P-009：恢复会话会卡在 `get_messages`
**证据。** 243 条消息，566 KB，含启动约 1.5 秒。
**规则。** 先从 JSONL 画出界面，同时启动 pi，之后再对齐。不要让窗口或输入框等待 pi 启动；提示先排队，就绪后发送。

### P-010：子代理会话污染会话列表
**证据。** `~/.pi/agent/sessions/--cwd--/<session>/<run>/<id>/run-0/session.jsonl`
里是子会话。简单的递归扫描会把它们当聊天列出来。
**规则。** 只有工作区会话目录的直接子项才是主会话；嵌套文件标记为子代理运行，并从主列表隐藏。

### P-011：`get_messages` 包含 UI 必须映射的角色
**证据。** 返回的角色有 `system`、`user`、`assistant`、`toolResult`、
`custom`；系统消息包含提示分段和工具。
**规则。** 绝不把系统消息渲染成聊天。按 `toolCallId` 配对工具调用和结果；显式处理 custom/display 消息。

### P-012：恢复时模型可能不可用
**证据。** ThinkRail 规格说明：保存的会话模型可能不在当前提供商目录中；静默回退会按另一个模型计费。
**规则。** 显示保存或选择的模型；如果 pi 报告不可用，阻止发送并要求用户选择模型。绝不静默运行另一个模型。

### P-013：认证需要 TTY
**证据。** `pi auth login` 在没有交互终端时报错；pty 原型可用。
**规则。** 登录用 pty，输出通过带类型的 IPC 传输，绝不写日志，也不自己持久化凭据。

### P-014：登录输出可能包含密钥
**规则。** pty 缓冲区只放在内存，关闭时清空；不要写入日志、诊断或崩溃报告。要提醒用户终端是凭据暴露面。

### P-015：扩展 API 漂移
**证据。** pi 1.x 增加或修改扩展字段；bridge 必须在支持的版本范围内工作。
**规则。** 固定一个测试过的次版本范围，对可选 API 做特性检测，捕获 bridge 错误，并上报 `extension_error`，不要弄挂会话。

## 前端与性能

### P-016：O(n²) 流式更新
**证据。** PI-Desktop ADR 0242 指出：每个 token 都发送累积快照，是长轮次变慢的根因。
**规则。** 传输格式只传增量；16 ms 合并器；边界前立即发送；在 `message_end` 替换整条消息。

### P-017：每个 token 重渲染整个会话记录
**证据。** PI-Desktop ADR 0130 指出：已挂载的行保留了 React 树、Markdown AST 和 Shiki token；每帧 memo 会遍历每一行。
**规则。** 虚拟化或窗口化会话记录，按稳定 ID 对行做 memo，把实时尾部放在单独组件里，未变化的块不要重新解析 Markdown。

### P-018：Markdown/HTML 注入
**规则。** Streamdown 在渲染代理提供的 HTML 前会加固和净化。不要加绕过这条管线的自定义 rehype 插件。绝不让 webview 导航到模型提供的链接；只在用户明确点击时通过操作系统打开 `http(s)`/`mailto` 链接，绝不把 `data:` URL 当可信内容。

### P-019：巨大的工具结果
**证据。** 工具结果可能包含 base64 图片和数千行文本。
**规则。** 给渲染器的每个事件限制字节数；按需流式加载或展开；完整输出留在 pi 的文件里，或按路径获取。截断要如实显示。

### P-020：滚动和用户抢控制权
**规则。** 只有用户在底部时才跟随尾部；向上插入历史时保持锚点；用户阅读时绝不强制滚动。

### P-021：输入法和发送快捷键
**规则。** 输入法组合输入进行中时，不要按 Enter 发送。测试中文和日文输入。Shift+Enter 换行；Cmd+Enter 切换队列模式。

## 桌面外壳

### P-022：Finder 的 PATH
**证据。** pi-gpui 的原则和文档指出：从 Finder 启动的应用不会继承 nvm/fnm/Bun 的 PATH。
**规则。** 按顺序解析 pi：显式设置、继承的 PATH、常见安装位置、用户登录 shell（`$SHELL -lic 'printf ...'`，带超时）。结果缓存。

### P-023：窗口闪白
**规则。** 把 `BackgroundColor` 设为页面背景色，并在
`OnReadyToShow` 时显示，保证首帧观感。

### P-024：红绿灯按钮和自定义标题栏重叠
**规则。** 使用 `TitleBarHiddenInset`，遵守 `--mygo-titlebar-*` CSS 变量，标记拖拽区域，交互控件保持 `no-drag`。测试 macOS 浅色、深色和全屏。

### P-025：有运行任务时退出
**规则。** 提示正在运行的会话数量；给出取消和退出选项；关闭 stdin 让 pi 有序关闭；绝不静默留下孤儿子进程。

### P-026：可信页面加不可信内容
**规则。** 应用页面是可信的，可以调用 Go。不要在其中渲染第三方 HTML。用户 HTML 预览要用净化后的 Markdown，或独立的不可信 webview/自定义 scheme。

### P-027：日志泄露提示词和密钥
**规则。** 只记录运行元数据。绝不记录消息内容、pty 输出、token、`.env` 值或认证头。诊断包要脱敏。

## 流程与文档

### P-028：静默的语义合并
**证据。** pi-agent-desktop 的所有权文档指出：结构性漂移可能干净地合并，但结果是错的。
**规则。** 我们不分叉上游应用。对 bridge 和 pi 类型，保留一个小兼容层和测试，不复制大段代码。

### P-029：范围蔓延成 IDE
**证据。** ThinkRail/PI-Desktop 的功能列表；数百个 ADR。
**规则。** V1 是桌面编码代理，不是 IDE。延后清单要明确。每个面板都要用日常流程证明自己值得存在。

### P-030：靠假设而不是测量
**规则。** 性能、内存、启动和信任行为都要测量，并记录在 `testing.zh.md`。推断在文档和聊天中要标明。

### P-031：不要重复注册已安装扩展的工具（Q6）
**背景。** 用户的安装里已有 `todo`、`ask_user_question`、`subagents`、
skills，以及 guard/status 扩展。注册我们自己的版本会遮蔽它们或造成双重提示。
**规则。** bridge 只注册 `pis-*` 命令和会话状态。绝不注册 `todo`、
`ask_user_question`、`plan` 或 `subagents`。UI 渲染已安装工具的结果，并通过已安装 ask 扩展的 RPC 回退来提问。

### P-032：不要对 guard 包重复提示
**背景。** `cc-safety-net` 之类的包可能已经拦截工具调用。两个 guard 会产生两次批准，让用户困惑。
**规则。** 从 `get_commands` 和包列表检测已知 guard 包和命令；存在时默认关闭我们的 guard；说明当前启用的是哪个 guard。

### P-033：mygo dev 和单独的 Vite 服务器抢端口
**背景。** 先运行 `bun run dev:web` 做浏览器 QA，再运行 `mygo dev`，mygo 的开发服务器会因为 `Port 5173 is already in use` 启动失败，不过应用仍会加载已有的服务器。
**规则。** 运行 `mygo dev` 前停掉独立的 Vite 服务器，或为该次运行设置不同的 `devUrl`/端口。记录应用实际加载的是哪个服务器。

### P-034：即发即忘的扩展 UI 不是阻塞项
**现象。** 第一次真实会话出现“扩展正在等待输入”，因为每个 `extension_ui_request` 都被当成对话框。
**原因。** 启动包会发出 `setStatus`、`setWidget`、`notify`、`setTitle`
和 `set_editor_text`；只有 `select`/`confirm`/`input`/`editor` 会阻塞。
**规则。** 把即发即忘和对话框分开；绝不把即发即忘请求报成错误。保存状态和 widget，只把真正的对话框放进队列。

### P-035：用量对象各不相同，每次读取都要防护
**现象。** 一个没有 `usage.cost` 的合成会话测试数据，在用户扩展里触发
`totalTokens` 错误，也让前端有渲染风险。
**规则。** 在边界处规范化用量（`normalizeUsage`），每次显示或统计读取都要防护。旧会话或手工构造的会话里可能存在没有用量的助手消息，即使 pi 正常会写用量。

### P-036：HMR 重载会丢失当前会话（仅开发环境）
**现象。** 编辑前端代码会重载 webview；当前会话回到首页状态，因为状态存在内存里。
**规则。** 不要把它当生产行为。QA 时用开发深链（`PIS_OPEN_SESSION` /
`?session=`）重新打开。生产环境的重载最终应该从应用状态恢复上一个会话。

### P-037：用构造的历史记录 `--session` 恢复可能弄坏扩展
**证据。** 手写的一条种子助手消息没有 `usage`，让已安装扩展在第一次提示时抛错；同样的提示在 pi CLI 里加 `--no-session` 可以工作。
**规则。** QA 测试数据必须像 pi 自己的输出（包含 usage 和 model 字段）。不要因为测试数据格式不对就断定应用坏了。

### P-038：计划模式必须保留只读 shell 访问
**现象。** 计划模式的第一版直接移除了 `bash`，模型只能用文件工具查看项目。
**规则。** 计划模式保留 `bash`/`powershell`，在 `tool_call` 中拦截会修改状态的命令；不要把“只读”等同于“没有 shell”。

### P-039：快速会话记录迁移的竞态
**现象。** 恢复的会话先画出快速记录，随后会话 key 从临时路径 key 变成 pi 的应用 id，条目消失了。
**规则。** `openSummary` 在迁移前同时等待记录读取和 pi 启动完成，并使用当前存在的条目；遇到未知应用 id 时先缓冲事件。

### P-040：状态 UI 和对话框 UI 是不同协议
**现象。** 启动包看起来像阻塞对话框，因为每个 `extension_ui_request` 都被报成错误。
**规则。** 即发即忘（`notify`、`setStatus`、`setWidget`、`setTitle`、
`set_editor_text`）只更新状态；只有 `select`/`confirm`/`input`/`editor`
进入阻塞对话框队列。

### P-041：用量对象没有保证
**现象。** 一个没有 `usage` 的合成会话让已安装扩展在 `totalTokens` 上抛错；前端防护避免应用再添一个自己的故障。
**规则。** 摄入时规范化用量；渲染时把 cost/tokens 当可选字段。

### P-042：bridge 源码必须带版本
**现象。** 改了 `bridge.ts` 但没有提升 `bridge.Version`，pi 会继续从应用数据目录加载旧文件。
**规则。** 源码一变就提升 `internal/bridge/bridge.go` 的 `Version`；`Ensure` 会写新文件并删除旧的 `pis-bridge-*.ts`。

### P-043：批准文案要有人能理解的风险标签
**现象。** 第一个批准对话框显示原始正则表达式，用户没法据此判断。
**规则。** 把检测规则映射成标签（“递归删除”“安装软件包”“工作区外”），并附上命令或路径。

### P-044：信任决策归应用所有，但要兼容 pi
**现象。** RPC 没有信任 UI；不带标志时项目资源会静默不加载。
**规则。** 读取 pi 的 `trust.json`，把 PiS 的决策存在应用设置里，只有用户同意后才传 `--approve`。绝不写 pi 的信任文件。

### P-045：Q6 扩展冲突
**现象。** 检测到 `cc-safety-net` 时会和内置批准 guard 双重提示；通用注册 `todo`/`ask` 会遮蔽用户工具。
**规则。** 检测已知 guard，除非强制否则默认关闭我们的 guard；bridge 命令用 `pis-*`；绝不注册 `todo`、`ask_user_question`、`plan` 或 `subagents`；已安装 plan 命令时展示它，不要声称自己有。

## UI 系统、Markdown 与打包

### P-046：未分层按钮重置压过 Tailwind 工具类
**现象。** 禁用的发送按钮显示灰色圆底上的深色箭头，菜单和工具栏按钮上的 `text-subtle` 也不生效。
**原因。** `button, input, textarea { color: inherit }` 没有放进层。Tailwind
工具类位于 `@layer utilities`；未分层的 CSS 无论优先级如何都会赢。
**规则。** 把元素重置放进 `@layer base`。Tailwind 工具类需要覆盖全局元素选择器时，绝不把选择器放在层外。

### P-047：源映射让内嵌应用膨胀
**现象。** Markdown 渲染器合入后，发布版 `.app` 从 14.4 MB 涨到 43.8 MB；
`frontend/dist/assets` 有 687 个文件，其中 21 MB 是 `.map` 文件。
**规则。** 只有需要单独调试产物时才生成生产源映射。Vite 生产构建设置 `sourcemap: false`；应用恢复到 22.7 MB。

### P-048：不要宣传没有接上的快捷键
**现象。** 命令面板显示 `⌘⇧T`、`⌘⇧C` 和 `⌘⇧M`，但只有面板显示它们，按键没有反应。输入框写着“按 Esc 停止”，但没有全局 Escape 处理器。
**规则。** 每个展示的快捷键都必须在窗口级按键处理器里实现并测试。Escape 要加条件：Base UI 对话框（`[data-slot="dialog-popup"]`）、菜单或待处理的扩展对话框打开时跳过；检查 `defaultPrevented`，让输入框的建议菜单可以消费它。

### P-049：外部链接让 webview 导航
**现象。** 点击 Markdown 链接会用目标站点替换应用页面。
**规则。** 在文档级拦截 `http:`、`https:` 和 `mailto:` 锚点，阻止默认行为，调用 shell 的 `OpenExternal`。跳过组件已经处理的事件（例如提供商文档链接）。

### P-050：Streamdown 数学公式需要显式开启单美元符号
**现象。** `$O(1)$` 被原样显示，尽管数学插件和 KaTeX CSS 都已引入。
**原因。** `@streamdown/math` 的 `singleDollarTextMath` 默认是 false。
**规则。** 用 `createMathPlugin({ singleDollarTextMath: true, errorColor: "var(--danger)" })` 构建插件。KaTeX CSS 只导入一次。表格、围栏代码和 `$$` 块用默认插件就能工作。

### P-051：空白实时会话隐藏了起始卡片
**现象。** 已有会话后点击“新建聊天”，显示大片空记录，只有“新建聊天”，而初始首页显示三个起始操作。
**规则。** 任何活动会话只要没有解析出的条目、也没有错误或加载中的运行，就渲染 `EmptyState`，不要只在没有活动会话时渲染。

### P-052：设置里显示占位符而不是检测到的 pi
**现象。** `settings.piPath` 未设置时，pi 可执行文件字段为空，尽管 bootstrap 已经有 `pi.path`；用户看到占位路径，不知道实际用的是哪个。
**规则。** 用 `settings.piPath ?? pi.path` 初始化可编辑字段；两者都不存在时，才把“Auto-detect pi”当占位符。

### P-053：shadcn 的 `muted` 是背景色，不是文字色
**现象。** 用户气泡和行内代码变成深灰色，因为应用的文字 token `--muted`
同时是 shadcn 的 `--muted` 背景 token。
**规则。** 应用次级文字用 `--subtle` / `text-subtle`；shadcn 的 `--muted`
映射到 `--surface-2`，`--muted-foreground` 映射到 `--subtle`。不要把一个 Tailwind 颜色 key 复用于两个含义。

### P-054：虚拟化替换的不只是列表组件，还有滚动所有权
**现象。** 把 Virtuoso 换成 `useVirtualizer` 后，最初挂载了全部 300
行，因为测试环境让滚动容器长到内容高度。限制高度后，滚动到最新和流式增长都需要重写；Virtuoso 的 `followOutput` 和 `atBottomStateChange` 在 TanStack Virtual 里没有对应物。
**规则。** 虚拟化会话记录需要一个所有者负责：受限的滚动元素、底部阈值、贴底状态、追加行为、行延迟增长和跳到最新。提交前用临时浏览器测试环境把五项都测一遍。用 flex 父容器和 `min-h-0` 限制滚动元素；webview 测试显示全部行是布局失败，不是虚拟化成功。

### P-055：直接升级大版本可能拆开传递依赖
**现象。** `katex` 作为直接 CSS 依赖从 0.16 升到 0.19，而
`@streamdown/math` 继续解析自己的 KaTeX 0.16。锁文件里现在有两个版本，可能出现 CSS 和标记不匹配。
**规则。** 更新同时作为传递依赖存在的直接依赖时，检查 `bun pm ls <pkg>`，实际跑一遍使用它的 UI（数学公式、高亮、图标），并记录版本拆分。不要静默假设最高版本就是渲染器使用的版本。重复版本没有好处时，优先选和使用方匹配的直接版本。

### P-056：macOS 符号链接工作区路径产生重复项目
**现象。** 打开 `/tmp/pis-p0` 新增一个项目，再打开它真实的 pi
会话（记录的是 `/private/tmp/pis-p0`），又新增一个同名项目。
**规则。** 比较和持久化前先规范化工作区路径：`filepath.Abs`，再
`filepath.EvalSymlinks`，再 `os.Stat`。bootstrap 时以及添加或删除项目时，按规范路径去重已有最近项目。显示名用规范路径的 basename。

### P-057：`git worktree list` 返回规范路径
**现象。** 在 `/var/...` 下创建的 worktree，在 `git worktree list` 里显示为
`/private/var/...`，集成测试比较不同字符串，找不到它。
**规则。** 返回前用 `filepath.EvalSymlinks` 规范化 porcelain 输出里的 worktree 路径。创建时保留用户输入的路径；比较和删除用规范形式。

### P-058：项目级 MCP 覆盖可能只带 `enabled`
**现象。** 合法的项目 `mcp.json` 条目如
`{"docs": {"enabled": false}}` 没有 command 或 URL。把它当成新服务器会丢掉用户级传输字段。
**规则。** 按名称把项目条目合并到用户条目上，项目条目省略 command/args/URL/type 时保留用户条目的值。只替换项目显式设置的传输字段；`enabled`、`exposure`
和 `description` 可以独立变化。

### P-059：翻译必须在渲染时执行，不能在缺少 locale 的 memo 里执行
**现象。** 在构建 `useMemo` 值（例如命令面板分组）时调用 `t()`，会存下英文文案；切换语言会重渲染根节点，但 memo 不重算，部分 UI 仍是英文。模块作用域调用 `t()` 对起始标签有同样问题。
**规则。** 源字符串保持为稳定数据，在渲染时调用 `t()`，或把 locale 放进 memo 依赖。根节点订阅 locale 变化，普通的渲染期查找就会刷新。不要留下重复的字典 key：TS1117 能抓到，但要删除过时的范围，而不是重命名其中一份。

### P-060：GitHub Actions 大版本更新需要检查使用方
**现象。** action 版本落后几个大版本。`upload-artifact` v7 和
`download-artifact` v8 基于 ESM，v8 把 digest 不匹配从警告变成硬错误。
`action-gh-release` v3 跑在 Node 24 上。
**规则。** 固定 `checkout@v7` 和 `setup-go@v7`；同一次运行产生的制品要一起用 `upload-artifact@v7` 和 `download-artifact@v8`，保证哈希一致；重跑时保留 `action-gh-release@v3` 的 `draft: true`。Windows 在 Ubuntu 上用 NSIS 构建，macOS 在 macOS 运行器上构建；Linux 运行器不能做临时签名或生成 DMG。

### P-061：PTY 退出可能和最后一次输出读取竞态
**现象。** pty 登录测试本地通过，Ubuntu CI 失败，报
`missing echo: "Login prompt\r\nhello\r\n"`；进程以 0 退出，但读取端没有送出最后的 `got:hello`。
**规则。** 保留 `readDone` channel。`cmd.Wait` 之后，等读取端排空（要有超时，防止子进程占着 pty），再关闭 `ptmx` 并发退出事件。登录窗口不能在最后一行可见前消失。

### P-062：产品改名会改变应用数据目录
**现象。** PiS 构建打开后是默认偏好，没有信任决策，因为 mygo 从显示名推导用户数据路径；旧的 `Pi Mygo` 目录还在磁盘上，直到手动删除。
**规则。** 把数据迁移当成单独的显式决策。改名时保留旧目录不动，不删除也不半合并；用户确认没有设置需要复制后再删。将来的迁移只能复制设置、信任和窗口状态。不要让两个应用身份指向同一个目录。

### P-063：正则表带不了标签
**现象。** 智能批准对 `RegExp` 数组调用 `rule.re.test(...)` 和
`rule.label`。这个数组是可执行 JavaScript，所以只有遇到有风险的 bash 命令时才失败。
**规则。** 把正则和人类可读标签放在同一个对象里，用 `.map((rule) => rule.re)`
导出会修改命令的正则。用 Vite+ 对 bridge 做类型检查；只 grep bridge 文本的 Go 测试抓不到这个问题。

### P-064：Vite+ 的类型感知检查包含内嵌 bridge
**现象。** `vp check` 会跟踪 `internal/bridge/bridge.ts`，并报告缺少
`@earendil-works/pi-coding-agent` 模块，尽管 bridge 运行在 pi 里，不在前端。
**规则。** 在 `internal/bridge/pi-coding-agent.d.ts` 声明这小组外部扩展接口，并在把动态工具输入转成字符串前做防护。不要用 ignore 模式把整个 bridge 静音；类型检查器在那里发现了真实的批准表 bug。

### P-065：Netlify 识别的是 bun.lockb，不是 bun.lock
**现象。** Netlify 在文档构建命令前运行了 `npm install`，因为仓库用的是文本
`bun.lock`，而 Netlify 文档中的自动 Bun 检测针对 `bun.lockb`。
**规则。** 手动部署时本地构建并上传 `docs-user-build/`。用 Git 集成时，显式设置
`bun install --frozen-lockfile && bun run docs:build`，并检查部署日志。不要加第二个锁文件。

当前部署只用 Cloudflare Pages，地址 `https://pis.modyqyw.top`。

### P-066：Vite+ 取代了单独的 tsc 命令
**现象。** `tsc -p frontend/tsconfig.json` 和 `tsc -p tsconfig.json`
重复了 `vp check` 已经做的类型检查。`build:web` 也跑了 tsc。
**规则。** 只保留一个类型检查入口：`bun run check:web`。完整入口是
`bun run check`。用一个临时类型错误确认 Vite+ 会跟踪前端和根配置。不要加第二条 tsc 路径。

### P-067：草稿发布不提供更新
**现象。** 发布工作流运行 `45369540750` 通过，创建了草稿 `v0.0.3`。
GitHub 仍把 `0.0.2` 报告为最新公开版本。更新源仍返回 `0.0.2`。
**规则。** 发布工作流变绿不等于发布。检查制品后运行
`gh release edit vX.Y.Z --draft=false --latest`，再确认 `isDraft=false` 和
`isLatest=true`。草稿不是更新源。

### P-068：pi 自定义消息没有 role 包装
**现象。** 后台任务通知等带 `"display": true` 的 `custom_message`
条目从未出现在记录里。Go 读取端把条目的 `content` 放进 `Entry.message`，但前端期望带 `role` 和 `content` 的消息对象，于是跳过了每条通知。
**规则。** pi 把 `custom_message` 写成顶层的 `{customType, content, display}`。把非消息形态的 `Entry.message` 当作自定义消息的 content，同时继续接受旧的 `{role:"custom", content}` 形状。

### P-069：项目信任也覆盖祖先目录的 `.agents/skills`
**现象。** 打开 `repo/packages/app` 没有弹出信任对话框，尽管
`repo/.agents/skills` 存在。PiS 没看到资源，用 `--approve` 启动 pi，于是 pi 在没有 PiS 决策的情况下加载了祖先 skills。
**规则。** 对齐 pi 的 `hasTrustRequiringProjectResources`：检查工作区的
`.pi` 资源，以及工作区和每一级祖先的 `.agents/skills`，排除用户的
`~/.agents/skills`。用临时 home 测试祖先目录的情况。

### P-070：改名的新路径在 `--numstat -z` 里排第二
**现象。** 重命名并编辑过的文件在变更面板显示 `+0 −0`。使用 `-z` 时，重命名记录是
`add\tdel\t\0old\0new\0`；读取端按旧路径记录统计，而状态报告的是新路径。
**规则。** 取第二个路径（`records[i+2]`），跳过两条路径记录，并在 git 集成测试里覆盖“重命名加编辑”的情况。
