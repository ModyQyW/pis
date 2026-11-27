# 构建、签名与发布

[English](release.md) | 简体中文

## 当前状态

- 当前 tag 为 `v0.0.9`。
- `0.0.9` 是公开 Release，也是 latest。
- macOS 使用 ad-hoc 签名。Windows 安装器未签名。Linux 使用 tar、deb、rpm 和 `install.sh`。

发布前用 `git tag` 和 `gh release list` 确认当前状态。

## 版本和更新

更新使用 GitHub Releases 和 Ed25519 密钥。

Releases 中的更新文件由发布流程生成：

- 每个平台的 update archive。
- 每个平台的 manifest。
- `SHA256SUMS`。

delta 已关闭（`updates.deltas: 0`）：更新下载完整 archive，Release 资产列表更短。

更新公钥必须在构建时设置。用户安装的旧版本用公钥验证新版本。

## 发布前

要求：

- 在 `main` 分支。
- 工作区干净。
- `main` 已包含要发布的源码。
- `gh` 已登录，并有 Release 权限。
- 下面的 CI secret 和 variable 已配置。

```sh
gh auth status
git status
git log --oneline -5
```

配置：

| 名称 | 类型 | 作用 |
|---|---|---|
| `PIS_UPDATE_PUBLIC_KEY` | variable | 更新公钥 |
| `MYGO_UPDATER_PRIVATE_KEY` | secret | 更新私钥 |
| `PIS_UPDATE_GITHUB` | variable | 仓库，例如 `ModyQyW/pis` |
| `MACOS_SIGNING_IDENTITY` | secret | 可选 Apple 签名身份 |
| `MACOS_NOTARY_PROFILE` | secret | 可选 notarytool profile |

没有更新私钥时，构建会跳过更新归档。用户可以安装新版本，但更新 feed 不完整。

私钥必须放在仓库外并备份。私钥丢失后，已安装用户无法验证新版本。

## 一键发布

```sh
./scripts/release.sh
```

脚本提示版本。直接回车使用建议的 patch 版本。

非交互环境：

```sh
PIS_VERSION=0.0.9 ./scripts/release.sh
```

脚本执行顺序：

1. 检查分支、工作区和 `gh` 登录。
2. 快进到 `origin/main`。
3. 安装依赖，运行 `bun run check`。
4. 生成 CHANGELOG 小节。
5. 拼接下载指引和 CHANGELOG 版本小节，供发布使用。
6. 修改 `mygo.config.ts` 的默认版本。
7. 提交 `chore(release): prepare <version>`。
8. 推送 `main`，创建并推送 `v<version>` tag。
9. 等待 Release workflow。
10. 校验 draft 资产和 `SHA256SUMS`。
11. 发布 draft，设为 latest。
12. 校验 `isDraft`、`isLatest` 和 `publishedAt`。

tag 已存在且指向 `HEAD` 时，脚本从等待 workflow 继续。它不会重复提交或打 tag。如果 tag 对应的 Release workflow 一分钟后仍未出现，脚本会失败；用 `gh workflow run release.yml -f version=v<version>` 手动启动。

## CHANGELOG

CHANGELOG 是唯一的发布记录。脚本把上一个 `v*` tag 到 `HEAD` 的提交写入目标版本小节。

过滤规则：

- 去掉 `chore(release): prepare <version>`。
- 去掉历史格式 `Prepare <version> release` 和 `Record <version> publication`。
- 去掉重复行。

目标版本的 CHANGELOG 小节已存在时，脚本保留手写内容。

发布时，脚本先把 `scripts/release-notes-header.md` 中的下载指引放在最前，再把对应 CHANGELOG 小节提取到临时文件。下载表格的每一项链接到 Release 资产。链接文字使用 `PISVERSION`，URL 使用 `__VERSION__`。`release.sh` 替换这两个标记。链接文字中的双下划线会变成 Markdown 强调，不得在那里使用。脚本用 `gh release edit --notes-file` 写入 Release。组装后的 notes 文件不进入仓库，header 模板会提交。

中文 CHANGELOG 是 `CHANGELOG.zh.md`。运行脚本前，先在中文文件加入同一个版本小节。这一处改动可以保持未提交；脚本会和英文小节一起提交。中文小节缺失时，脚本停止。

## Release workflow

`release.yml` 由 tag 触发，也可以手动触发。

Job：

| Job | 作用 |
|---|---|
| `draft` | 创建 draft Release |
| `quality` | 运行 `bun run check:web` |
| `build` | 构建 macOS、Windows、Linux 产物 |
| `verify` | 检查资产是否存在 |

构建矩阵：

- macOS：arm64 和 amd64。
- Windows：arm64 和 amd64。
- Linux：arm64 和 amd64。

三个平台串行构建。每个平台都会更新同一个 `SHA256SUMS`。并发上传会互相覆盖，导致 404。

workflow 只创建 draft，不发布 Release。发布由脚本完成。

## 本地构建

只构建本地产物：

```sh
./scripts/release.sh build
./scripts/release.sh build -platform "darwin/arm64,darwin/amd64"
```

或：

```sh
go tool mygo build
```

跨平台构建：

```sh
go tool mygo build -platform "linux/amd64,linux/arm64,windows/amd64,windows/arm64"
```

限制：

- macOS `.app` 和 DMG 必须在 macOS 上构建。
- Windows 安装器可以在 Ubuntu 上用 NSIS 生成。
- Linux 包在 Ubuntu 上生成。

带更新归档的本地构建：

```sh
export MYGO_UPDATER_PRIVATE_KEY_FILE="$HOME/Library/Application Support/PiS/update-keys/mygo-update.key"
export PIS_UPDATE_PUBLIC_KEY="$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
export PIS_UPDATE_GITHUB="ModyQyW/pis"
./scripts/release.sh build -platform "darwin/arm64,darwin/amd64" -upload
```

## 更新密钥

生成一对新密钥：

```sh
./scripts/update-keygen.sh
```

输出：

- `mygo-update.key`：私钥。
- `mygo-update.pub`：公钥。

设置到 GitHub：

```sh
gh variable set PIS_UPDATE_PUBLIC_KEY \
  --body "$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.pub")"
gh secret set MYGO_UPDATER_PRIVATE_KEY \
  --body "$(cat "$HOME/Library/Application Support/PiS/update-keys/mygo-update.key")"
gh variable set PIS_UPDATE_GITHUB --body "ModyQyW/pis"
```

不得把私钥提交到仓库，也不得打印到日志。

## 检查 draft

脚本自动检查。需要人工复核时：

```sh
gh release view vX.Y.Z --json isDraft,assets,publishedAt,url
gh run watch <run-id> --exit-status
```

检查清单：

- `isDraft` 为 `true`。
- 六个架构产物存在。
- `SHA256SUMS` 存在。
- 六个 `update-*.json` manifest 存在。
- 不附带 delta 文件（`updates.deltas` 为 0）。
- Release notes 以下载表格开头，每一项链接到对应资产。
- CHANGELOG 版本小节没有密钥、内部路径或未完成声明。

资产名称：

```text
pis-<version>-arm64.dmg
pis-<version>-amd64.dmg
pis-setup-<version>-arm64.exe
pis-setup-<version>-amd64.exe
pis-<version>-linux-arm64.tar.gz
pis-<version>-linux-amd64.tar.gz
update-darwin-arm64.json
update-darwin-amd64.json
update-linux-arm64.json
update-linux-amd64.json
update-windows-arm64.json
update-windows-amd64.json
```

## 发布 draft

脚本在验证后执行：

```sh
gh release edit vX.Y.Z \
  --title "PiS X.Y.Z" \
  --notes-file <临时 CHANGELOG 小节> \
  --latest \
  --draft=false
```

检查结果：

```sh
gh release view vX.Y.Z --json isDraft,publishedAt,url
gh release list --limit 1 --json tagName,isLatest
```

要求：

- `isDraft` 为 `false`。
- `isLatest` 为 `true`。
- `publishedAt` 不为空。

## 发布后验证

1. 安装上一个公开版本。
2. 在应用中检查更新。
3. 确认更新目标为新版本。
4. 安装更新。
5. 确认应用版本。
6. 确认项目、会话、设置和扩展仍可读取。
7. 在 macOS 验证 Gatekeeper 放行。
8. 在 Windows 和 Linux 安装一次。

没有对应机器时，记录「跳过」和原因。不得用构建成功代替运行时验证。

## 失败和重跑

workflow 失败时：

```sh
gh run rerun <run-id> --failed
```

脚本发现失败的 workflow 时，会先重跑失败的 job。

发布步骤失败时，重新运行同一个版本：

```sh
PIS_VERSION=X.Y.Z ./scripts/release.sh
```

tag 已存在且指向 `HEAD` 时，脚本跳过提交和 tag，继续等待和校验。

## 签名和 Gatekeeper

- macOS：ad-hoc 签名，不 notarize。
- Windows：未签名。
- Linux：安装包和 `install.sh`。

签名和更新的关系：

- Apple 代码签名控制应用能否启动。
- Ed25519 签名控制更新文件是否可信。
- 两者独立。

发布后不得修改 bundle ID 和更新公钥。bundle ID 变化会被系统视为新应用。

## 发布检查清单

- 工作区干净，`main` 已推送。
- `bun run check` 通过。
- 版本号正确。
- 中英文 CHANGELOG 都有版本小节。
- 更新密钥和 repository 变量已配置。
- tag 指向正确的提交。
- Release workflow 通过。
- draft 的六个架构产物存在。
- `SHA256SUMS` 和 manifest 正确。
- Release 已发布，且为 latest。
- 上一个公开版本到新版本的更新通过。
- Windows 和 Linux 运行时检查已完成，或已记录跳过。

## 相关文档

- [本地开发](./development.zh.md)
- [测试](./testing.zh.md)
- [文档站维护](./docs-site.zh.md)
