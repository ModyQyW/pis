# 功能实现

[English](features.md) | 简体中文

本页把每个用户功能对应到代码路径、数据来源和测试。修改功能前先读本页。

## 会话启动与恢复

`Agent.Start` 验证工作目录，启动 `pi --mode rpc`，等待 `get_state`。

- 新会话用生成的 app id 作为 `--session-id`。
- 恢复会话使用 `--session <path>`，同时分配新的 app id。
- 项目信任后才加入 `--approve`。
- bridge 通过 `-e <bridge>` 加载。
- `fetchState` 填充模型、会话文件、会话名和运行状态。

manager 把 app id 映射到进程。进程持有 stdin、stdout、stderr、等待中的调用和 stderr 尾部。

`onExit` 从 map 删除会话，并发送 `status: exited` 事件。所有等待中的调用收到 `pi exited`。

测试：`internal/agent/manager_integration_test.go`（可选真实 pi）、`internal/agent/coalesce_test.go`、`internal/agent/process_test.go`。

## 对话列表与删除

`Sidebar` 显示打开中的会话和最近会话。对话行有垃圾桶图标，用于删除单个对话。「选择对话」把行变为复选框，并显示批量删除操作。

`App.tsx` 为所有目标路径打开一个确认框。它用 `Agent.Close` 关闭每个活动会话，再调用 `Sessions.Delete` 删除文件。`Sessions.Delete` 把文件移到系统废纸篓；项目文件不受影响。

测试：`frontend/src/store/chat.test.ts` 覆盖启动中关闭；删除复用现有会话服务。

## 流式输出

pi 把 token 增量作为 `message_update` 事件发送。Go coalescer 按会话、类型和内容索引，在 16 ms 窗口内合并。

前端 store 保存 `live` 助手对象。`text` 和 `thinking` 事件更新实时块。`message_end` 追加完整条目，并清空实时对象。

边界：

- 非增量事件先 flush 待处理文本。
- 工具调用开始和结束会 flush 文本。
- 内容索引和类型相同的增量合并。
- `message_end` 的完整消息替换实时块。

测试：`internal/agent/coalesce_test.go`、`frontend/src/lib/transcript.test.ts`、`frontend/src/store/chat.test.ts`。

## 会话记录

`frontend/src/lib/transcript.ts` 从以下来源生成显示项：

- JSONL 或实时 store 中的会话条目。
- 实时助手块。
- 工具运行记录。

工具调用和工具结果按 id 配对。孤立工具结果单独成行。压缩摘要和分支摘要显示为分隔行。扩展 `custom_message` 按顶层 `content` 渲染；旧的 `{role, content}` 对象也支持。

`SessionTranscript` 使用 TanStack Virtual。它渲染可见区域和 overscan，测量动态行，并在读者停留在底部时固定视口。

Markdown 按需加载。`Markdown.tsx` 配置 Streamdown 的 code、math、CJK 和 Mermaid 插件。代码字号来自 CSS 变量。

测试：`frontend/src/lib/transcript.test.ts`。

## 工具卡片

工具数据来自两个来源：

- `tool_execution_start`、`tool_execution_update` 和 `tool_execution_end` 事件生成 `runs` 记录。
- 会话记录中的工具结果消息带有最终结果。

`ToolCard` 显示工具名、目标、状态、耗时、输出、diff 或 patch、图片和参数。`ask_user_question` 调用显示为问题卡片，并标出已选答案。

工具目标来自常见参数：`command`、`path`、`pattern`、`questions` 和 `description`。

测试：`frontend/src/lib/questions.test.ts`、`frontend/src/lib/transcript.test.ts`。

## 输入框

`Composer.tsx` 处理文本、草稿、附件、文件搜索、命令和模型选择入口。

- 草稿按会话保存在 `pis:draft:` 键下。发送失败时恢复草稿和附件。
- `@` 搜索调用 `Files.Search`。Go 服务缓存文件列表，并按 basename 和路径评分排序。
- `/` 列出 `get_commands` 返回的命令。
- 图片最大 10 MB，文本文件最大 512 KB，作为附件。
- 发送键来自 `settings.sendOnEnter`。
- 会话正在流式输出时，新 prompt 使用 `streamingBehavior: "steer"`。

测试：`frontend/src/store/chat.test.ts`、`internal/files/files_test.go`。

## 项目信任

`internal/trust/Inspect` 生成资源列表。

- 检查工作区根目录的 `.pi` 资源。
- 检查工作区和所有上级目录的 `.agents/skills`。
- 排除用户自己的 `~/.agents/skills`。
- 先读 PiS 保存的决定，再读最近的 pi `trust.json` 记录。
- 未决定的项目显示信任对话框。

信任的项目用 `--approve` 启动 pi。PiS 从不写入 pi 的信任文件。

测试：`internal/trust/trust_test.go`。

## 审批与计划模式

`internal/bridge/bridge.ts` 在 pi 进程内运行。

- `tool_call` 处理程序检查策略和工具输入。
- Smart 检查破坏性 shell、敏感文件、工作区外路径和修改类工具。
- 会话 grant key 是 `工具 + 命令或路径`。
- 拒绝调用时返回 `{ block: true, reason }`。
- 计划模式限制活动工具，注入指令，并阻止修改类工具和常见修改 shell 命令。
- 计划状态保存在 `pis-plan` 条目中，并在会话启动时恢复。

测试：`internal/bridge/bridge.test.ts`。

## 更改、文件与 Git

`internal/gitx` 用固定超时读取 Git 状态。

- `Status` 解析 `status --porcelain=v1 -z` 和 `diff --numstat -z`。
- 重命名使用新路径匹配统计。
- `Diff` 返回 `HEAD` 差异；未跟踪文件返回完整新增。
- `Revert` 使用 `git restore --source=HEAD --staged --worktree`。
- 工作树列表、创建和移除封装 `git worktree`。

`internal/files` 列出 Git 文件或遍历工作区，缓存列表 20 秒，并按大小限制预览。预览和未跟踪 diff 解析符号链接，并检查工作区边界。

测试：`internal/gitx/integration_test.go`、`internal/files/files_test.go`。

## pi 配置

`internal/piconf` 读取 pi 的用户配置，并在「pi 配置」对话框中列出。

- `Inspect` 读取 `settings.json` 的默认值和资源、`models.json` 的提供商（包括 JSONC 注释和尾随逗号）、发现的技能文件夹、pi 会加载的扩展文件夹、包来源和合并后的 MCP 服务器。没有项目时也读取用户级 MCP 服务器；项目级服务器带有信任状态。
- 信任前只列出项目配置的路径，不读取内容。信任后列出发现的项目级资源，并显示 `internal/trust` 的活动状态；项目默认值单独显示，用户默认值仍可编辑。
- 用户级配置的指纹控制确认提示。
- `Models` 运行 `pi --list-models`，解析提供商和模型列，供默认模型选择器使用。
- `SetDefaults`、`SaveProvider`、`RemoveProvider`、`AddPath`、`RemovePath`、`AddPackage` 和 `RemovePackage` 原子写入 pi 的 `settings.json` 或 `models.json`。设置写入使用 pi 的 `settings.json.lock`；未知字段、旧版 `skills` 对象字段和模型字段会保留。
- `Inspect` 只返回 `apiKeySet` 和 `apiKeyEnv`；已保存的密钥不会发送到页面。保存的密钥写入 `models.json`，下次编辑时输入框为空。
- 只写入包声明，不安装包。pi 在会话启动时安装。

测试：`internal/piconf/piconf_test.go`。

## MCP

`internal/mcp` 读取用户和项目 `mcp.json`。

- `List` 合并用户和项目条目。项目条目只能覆盖 `enabled`、`exposure` 和 `toolExposure`。
- `Add` 拒绝重名，并写入简单条目。
- `SetEnabled` 只修改所选文件的 `enabled` 字段。
- `Remove` 从所选文件删除条目。
- `writeConfig` 保留未知顶层字段，并原子写入。

测试：`internal/mcp/mcp_test.go`。

## 扩展与对话框

pi 发送 `extension_ui_request` 记录。Go 把它们作为 `extension-ui` 事件转发，不进入事件归约。

前端处理：

- `notify`：toast。
- `setStatus`：状态栏。
- `setWidget`：设置打开时的 widget 区域。
- `setTitle`：保存，但不显示。
- `set_editor_text`：输入框文本。
- `select`、`confirm`、`input`、`editor`：内联对话框。

对话框响应通过 `Agent.RespondUI` 返回。带超时的对话框在超时后从界面移除。已关闭会话的事件直接丢弃。

测试：`frontend/src/store/chat.test.ts`。

## 会话搜索与命令面板

`internal/sessions.Search` 扫描最近会话和活动分支。

- 先匹配标题。
- 每个会话最多读取 2 MB。
- 摘要读取按路径、cwd、mtime 和 size 缓存。
- `List` 按文件头 cwd 过滤共享会话目录。

`CommandPalette` 防抖 180 ms，合并命令动作和会话命中。

测试：`internal/sessions/sessions_test.go`。

## 设置与界面语言

`internal/settings` 保存带版本的 JSON 文件。

- `merge` 填充缺失值，并迁移旧文件。
- 版本 2 增加 `sendOnEnter`；版本 1 文件保持 Enter 发送。
- `SetPreferences` 校验范围和语言值。
- `App.tsx` 在绘制前应用 `--code-font-size` 和 `--ui-scale`。
- 代码区域使用 `--code-font-size`；body 使用 `--ui-scale`。
- 设置对话框有「通用」和「pi 配置」两个标签。pi 配置标签渲染 `PiConfigPanel`；启动检查用 `PiConfigDialog` 渲染同一个面板。

前端字典在 `frontend/src/lib/i18n.ts`。`t()` 在渲染时调用。缺失键回退到英文源文本。

测试：`internal/settings/settings_test.go`、`frontend/src/lib/i18n.test.ts`。

## 更新与发布

mygo updater 窗口使用 GitHub Releases。`scripts/release.sh` 准备版本、CHANGELOG、tag、Release workflow、资产检查和发布。

Release notes 就是对应的 CHANGELOG 小节。脚本把它提取到临时文件，供 `gh release edit` 使用。

见[构建、签名与发布](release.zh.md)。

## 在哪里加测试

以下改动需要加测试：

- 会话解析、读取上限或缓存行为。
- 工具结果配对或会话记录渲染。
- 审批、信任或计划规则。
- 文件或路径边界。
- MCP 合并或写入。
- 可能丢失用户输入或泄漏进程的 store 状态。
- 设置迁移或校验。

命令和测试层见[测试](testing.zh.md)。
