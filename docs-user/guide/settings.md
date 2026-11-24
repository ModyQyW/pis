# 设置与数据

## 设置面板

设置分为几组：

### 外观

- 系统 / 浅色 / 深色主题
- 语言：English / 中文
- 显示原始扩展 widget（默认关闭）
- 桌面通知和测试通知

### Providers

PiS 不保存 API key。点击“Connect a provider”会在应用内的 pty 终端运行：

```sh
pi auth login <provider>
```

凭据由 pi 自己保存。PiS 不记录终端输出，也不会把内容写进日志或诊断。

### pi 可执行文件

可以自动检测，也可以填写绝对路径。PiS 会检查版本是否在支持范围内。

自动检测覆盖 `PIS_PI`、`PATH`、`$BUN_INSTALL/bin/pi`（默认 `~/.bun/bin/pi`）、
Homebrew、npm、pnpm 和 Volta 的常见全局路径。从 Finder 或桌面启动时，
PiS 会读取登录 shell 的 `PATH`，让 bun/npm 安装的 pi 脚本找到 node。

点击「使用此路径」后，填写的路径成为唯一来源。该路径不能运行时，设置页
显示这条路径的具体错误，不会悄悄换用其他安装。要恢复自动检测，清空输入框
再点击「使用此路径」。

### 审批

选择 Smart / Ask all / Allow all，并决定是否在检测到其他 guard 时强制启用内置审批。

### 诊断

诊断报告只包含版本、平台、数据目录和 pi 状态；不包含 prompt、凭据或 session 内容。

## 数据目录

macOS：

```text
~/Library/Application Support/PiS
```

其中可能有：

```text
settings.json       # 主题、语言、窗口、信任、审批等 PiS 设置
window-state.json   # 窗口位置和大小
extensions/         # 内置 pis-bridge 扩展
```

pi 自己的数据仍在 pi 的目录中：

```text
~/.pi/agent/
```

PiS 不复制、不重写 pi 的 session、auth、模型或扩展配置。

## 更新

应用包含 mygo updater。设置面板的「更新」区域和菜单里的
`Check for Updates…` 都能立即检查更新；后台默认每天检查一次。更新源由构建时的
`PIS_UPDATE_GITHUB` 或 `PIS_UPDATE_URL` 决定。

当前 macOS 构建是 ad-hoc 签名，更新归档由 Ed25519 密钥签名。首次安装仍可能需要 Gatekeeper 放行。

## 重置

如果需要排除设置损坏：

1. 先退出 PiS。
2. 把 `~/Library/Application Support/PiS` 移到一个备份位置。
3. 重新启动 PiS，确认默认设置可以运行。
4. 再按需迁移 `settings.json`，不要直接覆盖整个目录。

不要删除 pi 的 `~/.pi/agent`，那会丢失你的真实会话和登录状态。

下一步：[架构与数据流](/advanced/architecture)。
