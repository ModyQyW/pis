# 使用 pi 扩展

PiS 复用 pi 的扩展机制。扩展仍然由 pi 进程加载，PiS 只负责把 RPC 暴露的 UI 和工具结果呈现出来。

## 扩展放在哪里

pi 的常用位置：

```text
~/.pi/agent/extensions/    # 全局
<project>/.pi/extensions/  # 项目级
```

项目级扩展会在加载前触发信任对话框。只加载你信任的代码；扩展与 pi 进程拥有相同的系统权限。

安装完扩展后，按 pi 的方式重启会话或使用 `/reload`。PiS 不需要单独安装一份扩展。

## 支持哪些 UI

| pi RPC 能力 | PiS 表现 |
|---|---|
| 工具调用和结果 | 工具卡片 |
| `select` / `confirm` / `input` / `editor` | 内联 dock |
| notify | toast / 系统通知 |
| setStatus | 会话状态栏 |
| setWidget | 安静的 widget 区域 |
| setTitle | 会话标题 |
| 自定义 TUI 组件 | 不支持，使用文本回退 |

`ctx.ui.custom()`、自定义编辑器、终端输入和主题切换这类 TUI 能力不会在 PiS 中伪造。扩展应检测运行环境，提供文本或 RPC 回退。

## 内置 bridge

PiS 会把自己需要的一小段逻辑写成 bridge 扩展：

```text
~/Library/Application Support/PiS/extensions/pis-bridge-<version>.ts
```

它只注册 `pis-*` 命名空间：

- `/pis-navigate <entry>`：会话树导航
- `/pis-plan on|off`：计划模式
- `pis:plan`、`pis:guard`：状态键

它不会注册 `todo`、`ask_user_question`、`plan` 或 `subagents` 等通用名称，避免遮蔽用户已安装的扩展。

升级时旧版本 bridge 会自动清理，旧产品名对应的 bridge 文件也会被移除。

## 冲突处理

- 已有 guard 扩展时，内置审批默认关闭。
- 已有 plan 命令时，界面优先使用已有命令。
- 扩展错误会显示在界面上，不会静默吞掉。
- 扩展状态和 widget 不会抢占 transcript 空间。

下一步：[设置与数据](/guide/settings)。
