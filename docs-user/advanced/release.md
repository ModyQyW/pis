# 构建、签名与发布

## 当前状态

- `0.0.1` 和 `0.0.2` 已发布。
- `0.0.3` 只有 draft release。它没有发布，也不提供更新。
- `0.0.4` 是本次公开版本。
- 最新 tag 是 `v0.0.3`。`release.sh` 建议 `0.0.4`。
- macOS 使用 ad-hoc 签名。Windows 未签名。Linux 使用发行包和 `install.sh`。

## 1. 发布前检查

在仓库根目录执行：

```sh
git status
bun install --frozen-lockfile
bun run format
bun run check
PIS_DOCS_SITE_URL=https://<site-host> bun run docs:build
```

检查结果必须满足以下条件：

- 工作区干净。
- `CHANGELOG.md` 包含 `0.0.4`。
- `mygo.config.ts` 的默认版本是 `0.0.4`。
- Go build、vet、test 通过。
- Vite+ 格式、lint、类型检查通过。
- bridge 测试和前端测试通过。
- 前端构建和文档站构建通过。

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

## 3. 提交并推送源码

```sh
git status
git push origin main
```

发布 tag 前，`origin/main` 必须包含 `0.0.4` 源码。不得在未推送的 commit 上创建 tag。

## 4. 发布脚本

`scripts/release.sh` 负责版本、签名和 updater 归档。

没有设置 `PIS_VERSION` 时，脚本按以下顺序工作：

1. 从最近的 `v*` tag 推导下一个 patch 版本。
2. 提示输入版本。直接回车使用建议值。
3. 校验 semver。
4. 进入构建。

当前最新 tag 是 `v0.0.3`。脚本建议 `0.0.4`。

非交互环境必须显式设置版本：

```sh
PIS_VERSION=0.0.4 ./scripts/release.sh -platform "darwin/arm64" -upload
```

手动运行构建并需要 updater 归档时，设置以下环境变量：

```sh
export MYGO_UPDATER_PRIVATE_KEY_FILE="$HOME/Library/Application Support/PiS/update-keys/mygo-update.key"
export PIS_UPDATE_PUBLIC_KEY="$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
export PIS_UPDATE_GITHUB="ModyQyW/pis"
./scripts/release.sh -platform "darwin/arm64,darwin/amd64" -upload
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

## 6. 创建 tag

`origin/main` 和本地 `main` 必须一致。然后执行：

```sh
git tag v0.0.4
git push origin v0.0.4
```

tag 会触发 Release workflow。

## 7. Release workflow

Release workflow 执行以下步骤：

1. 创建 draft release。
2. 在 `quality` job 中运行 `bun run check:web`。
3. 在 macOS 构建两个架构的 `.app` 和 DMG。
4. 在 Ubuntu 构建 Windows 安装器和 Linux 包。
5. 上传更新归档、delta、manifest 和校验文件。
6. 在 `verify` job 中下载并检查产物存在。

Release workflow 不会自动发布 draft。draft 不是公开 Release。draft 不进入更新 feed。

## 8. 检查 draft

```sh
gh release view v0.0.4 --json isDraft,assets,publishedAt,url
gh run watch <release-run-id> --exit-status
```

检查以下内容：

- `isDraft` 为 `true`。
- macOS、Windows、Linux 的六个架构产物存在。
- `SHA256SUMS` 存在。
- 六个 `update-*.json` manifest 存在。
- `0.0.2 → 0.0.4` delta 存在。
- draft 文本没有密钥、内部路径和未完成声明。

## 9. 发布 draft

draft 检查通过后，设置标题、说明和 latest 标记，然后发布：

```sh
gh release edit v0.0.4 \
  --title "PiS 0.0.4" \
  --notes-file release-notes/0.0.4.md \
  --latest \
  --draft=false
```

发布后确认：

```sh
gh release view v0.0.4 --json isDraft,isLatest,publishedAt,url
```

结果必须满足：

- `isDraft` 为 `false`。
- `isLatest` 为 `true`。
- `publishedAt` 不为空。

## 10. 发布后验证

1. 安装 `0.0.2` 应用。
2. 在应用中执行 `Check for Updates`。
3. 确认更新目标为 `0.0.4`。
4. 安装更新。
5. 确认应用版本为 `0.0.4`。
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

- 工作区干净。
- `bun run check` 通过。
- `CHANGELOG.md` 包含 `0.0.4`。
- 版本为 `0.0.4`。
- `origin/main` 包含发布源码。
- `PIS_UPDATE_PUBLIC_KEY`、`MYGO_UPDATER_PRIVATE_KEY`、`PIS_UPDATE_GITHUB` 已配置。
- bundle ID 固定为 `top.modyqyw.pis`。
- Release workflow 通过。
- draft 的六个架构产物存在。
- `SHA256SUMS` 和 manifest 正确。
- `0.0.4` 已发布，`isDraft` 为 `false`。
- `0.0.4` 是 latest release。
- `0.0.2 → 0.0.4` 更新通过。
- 文档站在 Cloudflare Pages 和 Netlify 可访问。
- 已知限制和 Gatekeeper/SmartScreen 说明已发布。
