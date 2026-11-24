# 构建、签名与发布

## 当前状态

- `0.0.1` 和 `0.0.2` 已发布。
- `0.0.3` 已准备，尚未发布。
- macOS 使用 ad-hoc 签名，不做 notarization。
- Windows 不做代码签名。
- Linux 使用发行包和 `install.sh`。
- 文档站单独部署。步骤见[部署文档站](/advanced/docs-deployment)。

## 1. 发布前检查

在仓库根目录执行：

```sh
git status
bun install --frozen-lockfile
bun run format
bun run check
bun run docs:build
```

检查结果必须满足以下条件：

- 工作区没有意外改动。
- `CHANGELOG.md` 包含 `0.0.3` 条目。
- `mygo.config.ts` 的默认版本是 `0.0.3`。
- Go build、vet、test 全部通过。
- Vite+ 格式、lint、类型检查全部通过。
- bridge 测试和前端测试全部通过。
- 前端构建和 `docs-user-build/` 构建全部通过。

如果文档有改动，先按[部署文档站](/advanced/docs-deployment)完成本地预览。文档站部署和应用发布互不依赖。可以按任意顺序执行。

## 2. 本地构建

```sh
bun run build
```

macOS 产物在 `build/darwin-arm64/` 和 `build/darwin-amd64/`。

跨平台构建：

```sh
go tool mygo build -platform "linux/amd64,linux/arm64,windows/amd64,windows/arm64"
```

macOS 的 `.app` 和 DMG 必须由 macOS 构建。Windows 安装器可以在 Ubuntu 上用 NSIS 生成。Linux 包也在 Ubuntu 上生成。

## 3. 发布脚本

`scripts/release.sh` 负责版本、签名和 updater 归档。

没有设置 `PIS_VERSION` 时，脚本按以下顺序工作：

1. 从最近的 `v*` tag 推导下一个 patch 版本。
2. 提示输入版本。直接回车使用建议值。
3. 校验 semver。
4. 进入构建。

当前最新 tag 是 `v0.0.2`。脚本会建议 `0.0.3`。

非交互环境必须显式设置版本：

```sh
PIS_VERSION=0.0.3 ./scripts/release.sh -platform "darwin/arm64" -upload
```

手动运行构建并需要 updater 归档时，设置以下环境变量：

```sh
export MYGO_UPDATER_PRIVATE_KEY_FILE="$HOME/Library/Application Support/PiS/update-keys/mygo-update.key"
export PIS_UPDATE_PUBLIC_KEY="$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
export PIS_UPDATE_GITHUB="ModyQyW/pis"
./scripts/release.sh -platform "darwin/arm64,darwin/amd64" -upload
```

## 4. 更新签名

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

## 5. GitHub Releases 工作流

发布 `0.0.3` 时，推送 `v0.0.3` tag。工作流执行以下步骤：

1. 创建 draft release。
2. 在 `quality` job 中运行 `bun run check:web`。
3. 在 macOS 构建两个架构的 `.app` 和 DMG。
4. 在 Ubuntu 构建 Windows 安装器和 Linux 包。
5. 上传更新归档、delta、manifest 和校验文件。

`quality` job 只运行一次 Vite+ 静态检查。三个平台的构建 job 不重复运行类型检查。

发布前检查以下内容：

- 六个架构产物都存在。
- `SHA256SUMS` 和 update manifest 正确。
- 0.0.3 的 delta 存在。
- draft 文本没有密钥、内部路径和未完成声明。
- 未登录也能下载公开 Release asset。

## 6. 发布后验证

发布 draft 后，执行以下步骤：

1. 安装最新的 `0.0.2` 应用。
2. 在应用中执行 `Check for Updates`。
3. 确认更新目标为 `0.0.3`。
4. 安装更新。
5. 确认应用版本为 `0.0.3`。
6. 确认项目、会话、设置和扩展仍可读取。
7. 在 macOS 验证 Gatekeeper 放行流程。
8. 在 Windows 和 Linux 各执行一次安装和更新检查。

Windows 和 Linux 验证需要对应机器。没有机器时，记录「跳过」并写明原因。

## 7. 文档站部署

文档站不随应用 Release 自动发布。维护者手动部署：

- Cloudflare Pages
- Netlify

完整步骤见[部署文档站](/advanced/docs-deployment)。
部署后检查公开 URL。文档站部署不阻塞应用 Release。维护者可以按需要调整顺序。

## 8. 签名策略

当前策略：

- macOS：ad-hoc 签名，不 notarize。首次打开需要 Gatekeeper 放行。
- Windows：未签名。SmartScreen 会显示首次警告。
- Linux：使用 tar、deb、rpm 和 `install.sh`。

如果以后配置 Apple Developer ID 和 Windows 证书，可以在 `mygo.config.ts` 和 CI secrets 中接入。发布后不得随意修改 bundle ID 和更新公钥。

## 9. 发布检查清单

- 工作区干净。
- `bun run check` 通过。
- `CHANGELOG.md` 包含 `0.0.3`。
- 版本为 `0.0.3`。
- `PIS_UPDATE_PUBLIC_KEY`、`MYGO_UPDATER_PRIVATE_KEY`、`PIS_UPDATE_GITHUB` 已配置。
- bundle ID 固定为 `top.modyqyw.pis`。
- 干净安装通过。
- 0.0.2 → 0.0.3 更新通过。
- 0.0.3 的六个架构产物存在。
- `SHA256SUMS` 和 manifest 正确。
- 文档站在 Cloudflare Pages 和 Netlify 可访问。
- 已知限制和 Gatekeeper/SmartScreen 说明已发布。
