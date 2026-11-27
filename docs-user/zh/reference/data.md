# 数据、安全与隐私

PiS 把应用数据和 pi 数据分开保存。

它会读取 pi 的会话和配置，但不会重写 pi 的凭据或会话文件。只有你在应用中保存更改时，PiS 才写入 pi 的 `settings.json`、`models.json` 和 `mcp.json`。

## 应用数据

macOS：

```text
~/Library/Application Support/PiS/
```

Windows 和 Linux 的路径不同。打开「设置 > 诊断」，查看实际路径。

目录内容：

| 项目 | 内容 |
|---|---|
| `settings.json` | 主题、色板、语言、字号、通知、审批、信任、最近项目。完整字段见下方表格 |
| `window-state.json` | 窗口位置和大小 |
| `extensions/` | 内置 bridge 扩展 |

PiS 还会在 WebView 本地存储中保存：

- 每个会话的草稿。
- 上次打开的会话。
- 最近使用的 pi 会话文件。

草稿使用 `pis:` 前缀。它们不进入 pi 的会话文件。

## pi 数据

pi 的数据目录通常位于：

```text
~/.pi/agent/
```

其中包括：

- 会话文件 `sessions/`
- 登录状态 `auth.json`
- 模型配置
- 扩展和技能
- 信任记录

PiS 读取会话文件用于首屏和列表。pi 仍然是模型上下文的权威来源。

PiS 不修改 pi 的会话内容、凭据、模型或扩展配置。删除会话时，PiS 把会话文件移到系统废纸篓。

## 设置文件

`settings.json` 中的主要字段：

| 字段 | 作用 |
|---|---|
| `theme` | 模式：`system`、`light` 或 `dark` |
| `palette` | 色板：`amber`、`graphite`、`teal` 或 `ink` |
| `language` | `en` 或 `zh` |
| `codeFontSize` | 代码字号 |
| `uiFontSize` | 界面缩放 |
| `sendOnEnter` | Enter 是否发送 |
| `notifications` | 桌面通知 |
| `showWidgets` | 是否显示扩展 widget |
| `permissions` | 审批策略和其他 guard 设置 |
| `trust` | 各项目的信任决定 |
| `recents` | 最近项目 |
| `lastWorkspace` | 上次项目 |
| `piPath` | 手动设置的 pi 路径 |

PiS 设置了 schema 版本。旧版本设置会在加载时迁移。旧文件没有 `sendOnEnter` 时，PiS 保持 Enter 发送。

设置损坏时，参照[设置](/guide/settings)中的重置步骤。

## 凭据

- 登录由 pi 完成。
- 凭据保存在 pi 的目录中。
- PiS 不读取凭据内容。
- PiS 不记录登录终端输出。
- 诊断报告不包含凭据。

不得在项目文件中保存 API key。不得把密钥粘贴到公开的会话或截图里。

## 诊断和日志

PiS 不主动记录 prompt 或凭据。pi 进程的 stderr 会保留最后一段，并作为错误信息显示。pi 自己写出的内容不作过滤。

诊断报告包含：

- 应用版本。
- 平台和架构。
- 数据目录。
- 设置文件路径。
- pi 路径和版本。
- 设置加载错误。

诊断报告不包含会话内容。

## 远程内容

会话中的 Markdown 图片会直接加载，包括 `http(s)` 地址。

风险：

- 远程图片会暴露 IP 地址。
- 图片地址可以访问本机服务。
- 模型输出或导入的会话可能包含图片地址。

链接只有点击后才会打开。`data:` 和 `file:` 图片被阻止。

需要严格网络边界时，使用容器、虚拟机或受限账户。

## 安全边界

PiS 提供三层保护：

- 项目信任：是否加载项目级资源。
- 审批：单次工具调用是否放行。
- 计划模式：当前会话是否允许修改。

这三层都是产品级保护，不是内核沙箱。

扩展、工具和 pi 进程使用当前用户的系统权限。

需要强隔离时：

- 使用容器。
- 使用虚拟机。
- 使用受限用户。
- 使用 pi 自己的隔离能力。

## 支持范围

- pi `>= 1.6 < 2`。
- macOS、Windows 和 Linux 的 amd64/arm64 构建。
- 运行时验证以 macOS arm64 为主。
- Windows 和 Linux 构建存在，但运行时验证不完整。

macOS 构建使用 ad-hoc 签名，未 notarize。
Windows 安装器未签名。
Linux 使用 tar、deb、rpm 和 `install.sh`。

## 备份和恢复

需要迁移或重装时：

1. 退出 PiS。
2. 备份 PiS 数据目录。
3. 备份 pi 的数据目录。
4. 安装新版本。
5. 恢复需要的文件和设置。

不得直接覆盖整个 pi 数据目录。只迁移需要的会话或配置。

## 下一步

- [设置](/guide/settings)：修改应用设置。
- [故障排查](/reference/troubleshooting)：解决数据和启动问题。
