# 构建、签名与发布

## 本地构建

```sh
bun run build
```

macOS 产物在 `build/darwin-arm64/` 和 `build/darwin-amd64/`。跨平台构建：

```sh
go tool mygo build -platform "linux/amd64,linux/arm64,windows/amd64,windows/arm64"
```

macOS 的 `.app` 和 DMG 必须由 macOS 构建；Windows 安装器可以在 Ubuntu 上用 NSIS 生成，Linux 包也在 Ubuntu 上生成。

## 发布脚本

`scripts/release.sh` 负责版本、签名和 updater 归档。没有设置 `PIS_VERSION` 时，它会：

1. 从最近的 `v*` tag 推导下一个 patch 版本；
2. 提示输入版本，直接回车使用建议值；
3. 校验 semver；
4. 再进入构建。

非交互环境必须显式设置：

```sh
PIS_VERSION=0.0.1 ./scripts/release.sh -platform "darwin/arm64" -upload
```

手动运行构建但仍需要 updater 归档时，设置私钥：

```sh
export MYGO_UPDATER_PRIVATE_KEY_FILE="$HOME/Library/Application Support/PiS/update-keys/mygo-update.key"
export PIS_UPDATE_PUBLIC_KEY="$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
export PIS_UPDATE_GITHUB="ModyQyW/pis"
./scripts/release.sh -platform "darwin/arm64,darwin/amd64" -upload
```

## 更新签名

更新归档由 Ed25519 密钥签名，不依赖 Apple 代码签名。

```sh
./scripts/update-keygen.sh
```

生成的 `mygo-update.key` 是私钥，必须放在仓库外并备份；`mygo-update.pub` 是公钥，可以放进 CI variable：

```sh
gh variable set PIS_UPDATE_PUBLIC_KEY \
  --body "$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
gh secret set MYGO_UPDATER_PRIVATE_KEY \
  --body "$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.key")"
gh variable set PIS_UPDATE_GITHUB --body "ModyQyW/pis"
```

私钥丢失后，已安装用户无法再验证新版本。

## 签名策略

当前发布策略：

- macOS：ad-hoc 签名，不 notarize；首次打开需要 Gatekeeper 放行。
- Windows：未做代码签名；SmartScreen 可能提示。
- Linux：使用发行包和安装脚本。

如果以后配置 Apple Developer ID 和 Windows 证书，可以在 `mygo.config.ts` / CI secrets 中接入；bundle ID 和更新公钥不要在发布后随意改变。

## Release workflow

推送 `v*` tag 会：

1. 创建 draft release；
2. 在 macOS 构建两个架构的 app/DMG；
3. 在 Ubuntu 构建 Windows 安装器和 Linux 包；
4. 上传签名更新归档、delta、manifest 和校验文件。

发布前必须检查：

- 六个架构产物都在；
- `SHA256SUMS` 和 update manifest 正确；
- draft 里的文本没有密钥、内部路径或未完成声明；
- 未登录也能下载公开 Release asset。

## 自动更新验证

第一次发布后不要直接宣布稳定。用两个版本做往返：

```text
安装 0.0.1 → 发布 0.0.2 → Check for Updates → 确认版本和会话仍正常
```

macOS 要同时验证 Gatekeeper、ad-hoc app 替换和重启；Windows/Linux 也要各跑一次。更新失败时保留旧版本，不要半写入。

## 发布检查清单

- 仓库或 release feed 公开可读
- `PIS_UPDATE_PUBLIC_KEY`、`MYGO_UPDATER_PRIVATE_KEY`、`PIS_UPDATE_GITHUB` 已配置
- bundle ID 固定为 `top.modyqyw.pis`
- CHANGELOG 和版本一致
- 干净安装 + 升级安装通过
- 自动更新 round-trip 通过
- 安全扫描和依赖审计通过
- 已知限制和 Gatekeeper/SmartScreen 说明已发布
