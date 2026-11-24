# 构建、签名与发布

## 当前状态

- `0.0.1`、`0.0.2`、`0.0.4` 和 `0.0.5` 已发布。
- `0.0.3` 只有 draft release。它没有发布，也不提供更新。
- 最新 tag 是 `v0.0.5`。
- 后续补丁版本从 `v0.0.5` 计算。
- macOS 使用 ad-hoc 签名。Windows 未签名。Linux 使用发行包和 `install.sh`。

## 1. 发布前准备

发布内容仍由维护者决定。提交代码改动后，补齐两项：

- `CHANGELOG.md` 包含目标版本的小节。
- `release-notes/<version>.md` 包含用户可读的发布说明。文件缺失时，
  脚本会从 `CHANGELOG.md` 生成一份并补上 compare 链接。

脚本会自行执行 `bun install --frozen-lockfile` 和 `bun run check`。
`check` 覆盖 Go build、vet、test、Vite+ 格式、lint、类型检查、bridge
测试、前端测试、前端构建和文档站构建。

## 2. 一次性发布

在干净、已推送的 `main` 上执行：

```sh
./scripts/release.sh 0.0.5
```

或非交互地指定版本：

```sh
PIS_VERSION=0.0.5 ./scripts/release.sh
```

不传版本时，脚本从最近的 `v*` tag 推导下一个 patch 版本，并在终端提示确认。
脚本按顺序完成：

1. 校验 `main`、干净工作区、`gh` 登录状态，并快进到 `origin/main`。
2. 校验 `CHANGELOG.md` 的目标版本小节；缺少 release notes 时从 CHANGELOG 生成。
3. 把 `mygo.config.ts` 的默认版本改为目标版本。
4. 安装依赖并运行完整的 `bun run check`。
5. 提交 `Prepare <version> release`，推送 `main`，创建并推送 `v<version>` tag。
6. 等待 Release workflow 完成；没有运行时用 `gh workflow run` 触发。
7. 校验 draft 中的六个平台产物、`SHA256SUMS` 和六个 updater manifest。
8. 用 `release-notes/<version>.md` 发布 draft，并设为 latest。
9. 校验 `isDraft=false`、`isLatest=true`、`publishedAt` 非空。

tag 推送后流程中断时，直接在同一个 commit 上重跑脚本。tag 已存在且指向
`HEAD` 时，脚本从等待 workflow 继续，不会重复提交或打 tag。

## 3. 本地构建

只需要本地产物时使用 `build` 子命令：

```sh
./scripts/release.sh build
./scripts/release.sh build -platform "darwin/arm64,darwin/amd64"
```

macOS 产物在 `build/darwin-arm64/` 和 `build/darwin-amd64/`。

跨平台构建：

```sh
go tool mygo build -platform "linux/amd64,linux/arm64,windows/amd64,windows/arm64"
```

macOS 的 `.app` 和 DMG 必须由 macOS 构建。Windows 安装器可以在 Ubuntu 上用 NSIS 生成。Linux 包也在 Ubuntu 上生成。

## 4. 带签名的本地构建

`build` 模式负责版本、签名和 updater 归档。非交互环境必须显式设置版本：

```sh
PIS_VERSION=0.0.5 ./scripts/release.sh build -platform "darwin/arm64" -upload
```

手动运行构建并需要 updater 归档时，设置以下环境变量：

```sh
export MYGO_UPDATER_PRIVATE_KEY_FILE="$HOME/Library/Application Support/PiS/update-keys/mygo-update.key"
export PIS_UPDATE_PUBLIC_KEY="$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
export PIS_UPDATE_GITHUB="ModyQyW/pis"
./scripts/release.sh build -platform "darwin/arm64,darwin/amd64" -upload
```

## 5. 更新签名

更新归档由 Ed25519 密钥签名。更新签名不依赖 Apple 代码签名。

```sh
./scripts/update-keygen.sh
```

`mygo-update.key` 是私钥。私钥必须放在仓库外并备份。`mygo-update.pub` 是公钥。公钥可以放入 CI variable。

```sh
gh variable set PIS_UPDATE_PUBLIC_KEY \
  --body "$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
gh secret set MYGO_UPDATER_PRIVATE_KEY \
  --body "$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.key")"
gh variable set PIS_UPDATE_GITHUB --body "ModyQyW/pis"
```

私钥丢失后，已安装用户无法验证新版本。

## 6. Tag 与重跑

tag 由发布脚本创建并推送，不需要手动执行。必须在 `origin/main` 已包含发布源码后打 tag。

如果 workflow 或发布步骤失败：

```sh
PIS_VERSION=X.Y.Z ./scripts/release.sh
```

tag 已存在且指向 `HEAD` 时，脚本会跳过提交和打 tag，重新等待 workflow，然后继续校验和发布。

## 7. Release workflow

Release workflow 执行以下步骤：

1. 创建 draft release。
2. 在 `quality` job 中运行 `bun run check:web`。
3. 在 macOS 构建两个架构的 `.app` 和 DMG。
4. 在 Ubuntu 构建 Windows 安装器和 Linux 包。
5. 上传更新归档、delta、manifest 和校验文件。
6. 在 `verify` job 中下载并检查产物存在。

Release workflow 不会自动发布 draft。发布脚本在 workflow 成功并校验产物后执行发布。draft 不是公开 Release，也不进入更新 feed。

## 8. 检查 draft

发布脚本会自动检查；需要人工复核时执行：

```sh
gh release view vX.Y.Z --json isDraft,assets,publishedAt,url
gh run watch <release-run-id> --exit-status
```

检查以下内容：

- `isDraft` 为 `true`。
- macOS、Windows、Linux 的六个架构产物存在。
- `SHA256SUMS` 存在。
- 六个 `update-*.json` manifest 存在。
- 上一个公开版本到目标版本的 delta 存在。
- draft 文本没有密钥、内部路径和未完成声明。

## 9. 发布 draft

发布脚本用 release notes 发布并设为 latest。需要手动恢复时执行：

```sh
gh release edit vX.Y.Z \
  --title "PiS X.Y.Z" \
  --notes-file release-notes/X.Y.Z.md \
  --latest \
  --draft=false
```

发布后确认：

```sh
gh release view vX.Y.Z --json isDraft,publishedAt,url
gh release list --limit 1 --json tagName,isLatest
```

结果必须满足：

- `isDraft` 为 `false`。
- `isLatest` 为 `true`。
- `publishedAt` 不为空。

## 10. 发布后验证

1. 安装上一公开版本。0.0.5 的上一个公开版本是 `0.0.4`。
2. 在应用中执行 `Check for Updates`，或打开设置点击 `Check for updates…`。
3. 确认更新目标为 `0.0.5`。
4. 安装更新。
5. 确认应用版本为 `0.0.5`。
6. 确认项目、会话、设置和扩展仍可读取。
7. 在 macOS 验证 Gatekeeper 放行流程。
8. 在 Windows 和 Linux 各执行一次安装和更新检查。

Windows 和 Linux 验证需要对应机器。没有机器时，记录「跳过」并写明原因。

## 11. 文档站部署

文档站不随应用 Release 自动发布。维护者手动部署：

- Cloudflare Pages
- Netlify

完整步骤见[部署文档站](/advanced/docs-deployment)。

## 12. 签名策略

- macOS：ad-hoc 签名，不 notarize。首次打开需要 Gatekeeper 放行。
- Windows：未签名。SmartScreen 会显示首次警告。
- Linux：使用 tar、deb、rpm 和 `install.sh`。

发布后不得随意修改 bundle ID 和更新公钥。

## 13. 发布检查清单

- 工作区干净，`main` 已包含发布源码。
- `CHANGELOG.md` 包含目标版本，`release-notes/<version>.md` 已就绪。
- `PIS_UPDATE_PUBLIC_KEY`、`MYGO_UPDATER_PRIVATE_KEY`、`PIS_UPDATE_GITHUB` 已配置。
- bundle ID 固定为 `top.modyqyw.pis`。
- `./scripts/release.sh <version>` 完成版本、检查、提交、push、tag 和发布。
- Release workflow 通过。
- draft 的六个架构产物存在。
- `SHA256SUMS` 和 manifest 正确。
- Release 已发布，`isDraft` 为 `false`。
- Release 是 latest release。
- 上一公开版本到目标版本的更新通过。
- 文档站在 Cloudflare Pages 和 Netlify 可访问。
- 已知限制和 Gatekeeper/SmartScreen 说明已发布。
