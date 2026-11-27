# 扩展

PiS 复用 pi 的扩展机制。扩展由 pi 进程加载，PiS 负责显示扩展的界面和结果。

## 扩展放在哪里

pi 的常用位置：

```text
~/.pi/agent/extensions/     用户级
<项目>/.pi/extensions/      项目级
```

也可以通过 pi 的包管理安装扩展。安装方式以 pi 文档为准。

项目级扩展在加载前会触发项目信任。只加载你确认过的代码。信任前，「pi 配置」对话框只列出项目配置的路径，不读取内容。

扩展和 pi 拥有相同的系统权限。安装前阅读扩展源码或发布说明。

## 查看和添加扩展

打开「设置 → pi 配置」。该标签列出：

- pi 用户文件夹中的扩展文件。信任项目后，也会列出项目的扩展文件。pi 发现 `.ts` 和 `.js` 文件，以及包含 `index.ts`、`index.js` 或 `package.json` `pi.extensions` 条目的包目录。
- `settings.json` 中配置的路径。
- `settings.json` 中的包来源。

pi 的内置扩展（`builtin:...`）不作为文件列出。

可以执行：

- 添加扩展文件或文件夹路径。PiS 写入 pi 用户 `settings.json` 的 `extensions` 列表。
- 添加包来源。PiS 写入 `packages` 列表。pi 在下次会话启动时安装包。
- 移除你配置的路径或包来源。
- 在文件管理器中显示项目。

PiS 不删除扩展文件。此对话框不能禁用自动发现的扩展；请删除或移动该文件。包内资源请使用终端中的 `pi config`。

## 加载扩展

启动会话时，pi 加载扩展。

修改扩展后，关闭会话并重新打开。具体加载行为以扩展文档为准。

PiS 不安装扩展，也不维护第二份扩展列表。

## 有专门适配的扩展

PiS 为以下扩展 API 提供专门显示。其他扩展使用通用工具卡片和 RPC 对话框。

| 扩展 | PiS 显示 | 限制 |
|---|---|---|
| `pi-subagents` | Agents 标签和子代理卡片，读取 `subagent` 工具调用和结果 | 未实现可选的主机组件协议 |
| `@juicesharp/rpiv-ask-user-question` | 内联问题卡片，显示选项和已选答案 | 使用工具的 RPC 回退 |
| `@juicesharp/rpiv-todo` | Plan 标签读取 `rpiv-todo-state` 自定义条目 | 只读显示 |
| `cc-safety-net`、`@juicesharp/rpiv-permissions` | 识别为已有 guard，PiS 审批默认关闭 | 规则在 pi 内运行，PiS 不显示 |
| `pi-lens`、`pi-web-access`、`pi-open-artifact` 等工具 | 通用工具卡片；通过 RPC 显示状态、widget 和对话框 | 不支持自定义 `ctx.ui.custom()` 组件 |

内置 `pis-bridge` 只添加 `pis-*` 命令：会话树、计划模式和审批，不占用通用命令名。

此表列出 PiS 按名称处理的集成，不是对每个扩展版本的兼容保证。扩展修改 RPC 接口时，请阅读其发布说明。

## 扩展界面

PiS 支持 pi RPC 提供的界面能力：

| pi 能力 | PiS 显示 |
|---|---|
| 工具调用和结果 | 工具卡片 |
| `select` | 内联选择对话框 |
| `confirm` | 内联确认对话框 |
| `input` | 内联输入框 |
| `editor` | 内联多行编辑器 |
| `notify` | toast 通知 |
| `setStatus` | 输入框上方的状态栏 |
| `setWidget` | 设置打开后显示可展开的 widget 区域 |
| `set_editor_text` | 写入输入框 |

扩展对话框显示在输入框上方，不遮挡会话。

![扩展对话框示例](/images/approval.png)

## 不支持的界面

pi 的 RPC 模式不支持部分终端界面：

- `ctx.ui.custom()` 自定义组件。
- 自定义编辑器和终端输入。
- 终端主题切换。
- 终端页眉、页脚和工作消息。
- `setTitle`：扩展标题会保存，但当前界面不显示。
- 部分 TUI 专用能力。

PiS 不会伪造这些能力。扩展需要检测运行环境，并提供文本或 RPC 回退。

如果扩展只提供 `custom()`，它在 PiS 中可能没有界面。请查看扩展文档。

## 内置 bridge

PiS 自带一个小的 bridge 扩展，用来补齐 RPC 缺口。

文件位置：

```text
~/Library/Application Support/PiS/extensions/pis-bridge-<版本>.ts
```

它只注册 `pis-*` 名称：

- `/pis-navigate`：会话树导航。
- `/pis-plan`：计划模式。
- `pis:plan` 和 `pis:guard`：状态键。

它只注册 `pis-*` 名称，不注册其他扩展常用的通用名称。你安装的扩展不会被它遮蔽。

PiS 升级时会删除旧的 bridge 文件。不得手动加载未知的 bridge。

## 扩展冲突

- 检测到其他 guard 扩展时，PiS 的内置审批默认关闭。
- 已安装其他 plan 命令时，界面优先使用已有命令。
- 扩展错误会显示在会话中，不会静默丢弃。

## 工具卡片

内置工具显示专用卡片：

- shell
- read
- edit
- write
- grep
- find
- ls
- todo
- ask_user_question
- subagent

其他扩展工具显示通用卡片。通用卡片显示工具名、参数、结果和错误状态。

## 状态和 widget

扩展可以设置状态文字。

- 状态显示在输入框上方。
- 最多显示 6 条状态。
- ANSI 颜色码会被移除。
- widget 默认关闭。可以在设置中打开。

widget 按终端布局设计。打开后可能占用较多空间。

## 扩展错误

扩展抛出错误时，会话中显示错误来源和消息内容。

处理步骤：

1. 检查扩展是否兼容 pi 的 RPC 模式。
2. 检查扩展版本。
3. 关闭会话并重新打开。
4. 在 pi 的终端模式中复现问题。

## 下一步

- [信任、审批与计划模式](/guide/approvals)：控制扩展工具的权限。
- [设置](/guide/settings)：打开 widget 和通知。
- [故障排查](/reference/troubleshooting)：解决扩展加载问题。
