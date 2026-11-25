# 更新日志

[English](CHANGELOG.md) | 简体中文

## 0.0.5（2026-11-24）

- 在设置中增加手动「检查更新…」按钮。帮助菜单项和每日后台检查保留。
- 配置的 pi 路径成为唯一来源。该路径不能运行时，设置页显示这条路径的错误，不再回退到自动检测的其他路径。
- 在检测 pi 和启动 pi 之前解析登录 shell 的 `PATH`。从 Finder 启动的应用现在可以运行需要 node 的 bun/npm 安装脚本，包括 `~/.bun/bin/pi`。
- 自动检测 `$BUN_INSTALL/bin`（默认 `~/.bun/bin`）以及 npm、pnpm 和 Volta 的常见全局位置。
- `scripts/release.sh` 一次完成发布：版本、说明、完整检查、提交、tag、推送、Release workflow、draft 校验和发布。`scripts/release.sh build` 保留 CI 使用的本地构建行为。
- 改进 pi 错误：路径不存在、路径是目录和 `--version` 失败现在有不同提示。

## 0.0.4（2026-11-24）

- 发布 0.0.3 draft 中准备的改动。0.0.4 是公开版本；0.0.3 draft 不是正式发布。
- 删除未使用的 `netlify.toml`。Netlify 部署使用手动上传或控制台设置。更新部署和发布文档。
- 应用行为与 0.0.3 源码相同。0.0.4 只修改版本、发布说明和文档。

## 0.0.3（2026-11-24，仅 draft）

- 增加 Vite+ 1.8（Oxlint、Oxfmt、tsrs）作为前端格式、lint 和类型检查门禁。`bun run format` 负责格式化，`bun run check` 和 `scripts/check.sh` 覆盖 Go 和 Vite+ 检查。
- 删除单独的 `tsc` 类型检查命令。Vite+ 一次检查前端、bridge 和根配置。
- 通过 `vp config --no-agent` 安装 Vite+ pre-commit hook。每次提交都运行完整验证门禁。
- 把 πS 标记替换为单色 π 加屈臂图标。提供白色和黑色背景版本，默认白色。开发应用使用黑色背景版本。
- 把 Rspress 用户指南拆到 `docs-user/`，把研究、决策、进度、QA 和交付记录拆到 `docs-dev/`。
- 增加 Cloudflare Pages 和 Netlify 部署说明。
- 修复 Smart 审批的破坏性命令表。正则曾被当成规则对象。提升 bridge 版本，让已安装的 bridge 副本刷新。

## 0.0.2（2026-11-24）

- 在 `docs-user/` 增加 Rspress 用户指南，覆盖从首次启动到架构和发布工作。
- 增加根 `tsconfig.json` 和配置类型检查到验证门禁。
- 未设置 `PIS_VERSION` 时，`release.sh` 提示版本并建议下一个 patch 版本，同时校验输入。
- 刷新审批截图和发布文档。
- 运行时行为与 0.0.1 相同。

## 0.0.1（2026-11-24）

- PiS 首次公开发布 macOS、Windows 和 Linux 版本。
- 产品标识为 PiS（`pis`），使用新的 πS 图标，并刷新桌面截图。S 表示 strong。
- 真实 pi 会话、流式会话记录、工具卡片、审批、计划模式、会话树、更改和扩展。
- TanStack Virtual 会话记录、Streamdown code/Mermaid 插件和原生桌面外壳。
- MCP 配置、工作树、会话文本搜索、待办面板、逐文件还原和原生完成通知。
