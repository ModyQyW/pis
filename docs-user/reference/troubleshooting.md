# 故障排查

## 找不到 pi

先确认：

```sh
which pi
pi --version
```

PiS 会依次检查设置中的路径、`PIS_PI`、`PATH`、常见安装位置和登录 shell。GUI 应用的 `PATH` 可能和终端不同，最稳妥的是在设置里填写 pi 的绝对路径。

版本必须在 `>= 1.6 < 2`。

## 登录失败

在设置里打开 “Connect a provider”，确认运行的是 pi 自己的登录流程。凭据由 pi 保存，PiS 不记录输出。

如果 pty 窗口没有响应，先关闭登录窗口再重试；不要同时打开多个登录 pty。

## macOS 提示无法打开

当前构建是 ad-hoc 签名：

```sh
xattr -dr com.apple.quarantine "/Applications/PiS.app"
```

或在“系统设置 → 隐私与安全性”允许打开。确认应用来自本仓库的 Releases；不要绕过来源检查。

## Windows SmartScreen

当前安装器未做代码签名。确认下载来源和 SHA256 后，选择“更多信息 → 仍要运行”。如果安全策略禁止未签名程序，请使用有签名的构建或自行构建。

## 项目扩展没有加载

通常是因为项目尚未信任。查看资源列表，确认路径和内容，再决定是否信任。信任后需要重新启动会话，已有会话不会热更新信任状态。

## 审批没有出现

- 检查设置中的审批策略是否为 `Allow all`。
- 检查是否检测到了其他 guard 扩展；检测到后内置审批默认关闭。
- 某些命令不在 Smart 规则的覆盖范围内。

审批不是沙箱；不要依赖它阻止所有风险。

## 自动更新失败

检查：

1. Release 仓库或 feed 是否公开可读。
2. `PIS_UPDATE_PUBLIC_KEY` 是否与签名私钥匹配。
3. Release 是否包含当前平台的 update archive 和 manifest。
4. 当前模型版本是否比 feed 中的版本旧。
5. macOS 替换 ad-hoc app 后是否被 Gatekeeper 拦住。

不要把更新私钥提交到仓库，也不要在日志里打印它。

## 设置损坏

退出 PiS，把 `~/Library/Application Support/PiS` 移到备份位置，再启动。不要把整个目录直接覆盖到别处；只迁移需要的设置字段。

## 收集诊断

设置里的诊断报告包含版本、平台、数据目录和 pi 状态，不包含 prompt 或凭据。提交 issue 时附上它，但先检查是否有本机路径需要脱敏。

## 旧版本残留

Bridge 文件会随着版本更新：

```text
extensions/pis-bridge-<version>.ts
```

如果看到旧的 bridge 文件，退出应用并确认当前版本启动过一次；内置清理会删除旧 `pis-bridge-*` 和旧产品名对应的 bridge 文件。不要手动加载未知扩展。
