# 环境变量与目录

## 运行环境变量

| 变量 | 作用 |
|---|---|
| `PIS_PI` | 指定 pi 可执行文件 |
| `PIS_OPEN` | 开发模式下启动时打开项目 |
| `PIS_OPEN_SESSION` | 开发模式下打开指定 session |
| `PIS_DEV_PROMPT` | 开发模式下自动发送一条 prompt |
| `PIS_GUARD_OVERRIDE` | 开发模式强制审批策略：`off`、`smart`、`ask`、`allow` |
| `PIS_INTEGRATION` | 设为 `1` 运行真实 pi 集成测试 |

这些变量只影响 PiS 的开发/调试行为，不会改变 pi 自己的配置。

## 构建与发布变量

| 变量 | 作用 |
|---|---|
| `PIS_VERSION` | 本次构建版本；release workflow 从 tag 注入 |
| `PIS_UPDATE_PUBLIC_KEY` | 更新公钥内容 |
| `PIS_UPDATE_URL` | 自定义更新 feed URL |
| `PIS_UPDATE_GITHUB` | GitHub Releases 仓库，例如 `ModyQyW/pis` |
| `MYGO_UPDATER_PRIVATE_KEY` | 更新签名私钥；CI secret |
| `MYGO_UPDATER_PRIVATE_KEY_FILE` | 本地构建时私钥文件路径 |
| `MACOS_SIGNING_IDENTITY` | 可选 Apple 签名身份 |
| `MACOS_NOTARY_PROFILE` | 可选 notarytool keychain profile |

## 应用数据

macOS：

```text
~/Library/Application Support/PiS/
  settings.json
  window-state.json
  extensions/pis-bridge-<version>.ts
```

pi 数据（PiS 只读）：

```text
~/.pi/agent/
  sessions/
  auth.json
  models.json
  extensions/
```

实际路径由 pi 和平台决定；以设置里的诊断信息为准。

## 会话与本地状态

- pi session JSONL：由 pi 管理，PiS 读取用于首屏和列表。
- PiS 草稿和最近会话键：`pis:` 前缀的 localStorage。
- 应用设置：`settings.json`。
- 窗口位置：`window-state.json`。

## 支持范围

- pi `>= 1.6 < 2`
- macOS、Windows、Linux 的 amd64/arm64 构建
- 运行时验证目前以 macOS arm64 为主；Windows/Linux 需要在实际机器上补齐 QA

## Bundle ID

```text
top.modyqyw.pis
```

它对应 `modyqyw.top` 的反向 DNS。发布后不要修改；修改会被系统视为新应用，并影响更新和权限。

下一步：[故障排查](/reference/troubleshooting)。
