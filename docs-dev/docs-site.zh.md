# 文档站维护

[English](docs-site.md) | 简体中文

用户文档由 `docs-user/` 生成，部署在：

```text
https://pis.modyqyw.top
```

开发文档不进入文档站。本文说明如何构建、部署和验证文档站。

## 术语

- 文档站：`docs-user/` 生成的 Rspress 静态站点。
- 构建产物：`docs-user-build/` 目录。
- 手动上传：本地构建后上传产物。
- Git 集成：Cloudflare Pages 拉取仓库，并在平台中运行构建命令。

## 共同条件

- 本地安装 Bun 1.4.5。
- 在仓库根目录执行构建。
- 构建命令是 `bun run docs:build`。
- 输出目录是 `docs-user-build`。
- 站点部署在根路径 `/`。
- 生产域名固定为 `https://pis.modyqyw.top`。
- `siteOrigin` 已在 `rspress.config.ts` 中设置，用于 sitemap。
- 文档站不需要 Go 和 pi。
- `docs-user-build/` 不进入 Git。

## 本地构建

```sh
bun install --frozen-lockfile
bun run docs:build
```

检查产物：

```text
docs-user-build/index.html
docs-user-build/404.html
docs-user-build/sitemap.xml
docs-user-build/icon.png
docs-user-build/icon-dark.png
```

本地预览：

```sh
bun run docs:preview
```

打开终端显示的地址。检查：

- 首页和导航。
- 指南页面。
- 参考页面。
- 明暗 Logo。
- 图片和代码块。
- 中文文本。

检查完成后停止预览进程。

## 部署到 Cloudflare Pages

### 手动上传

1. 在本地执行构建。
2. 打开 Cloudflare Dashboard。
3. 进入 `Workers & Pages`。
4. 选择现有的 PiS Pages 项目。
5. 选择 `Create deployment`。
6. 上传 `docs-user-build/`。
7. 等待部署完成。
8. 打开 `https://pis.modyqyw.top`。
9. 执行[上线验证](#上线验证)。

每次修改文档后，重新构建并上传。

手动上传不会修改 Git 集成设置。两种方式不得同时用于同一个部署。

### Git 集成

Cloudflare Pages 项目连接 GitHub 仓库 `ModyQyW/pis`。设置：

| 设置 | 值 |
|---|---|
| Framework preset | `None` |
| Root directory | `/` |
| Build command | `bun install --frozen-lockfile && bun run docs:build` |
| Build output directory | `docs-user-build` |

环境变量：

```text
BUN_VERSION=1.4.5
VP_GIT_HOOKS=0
SKIP_DEPENDENCY_INSTALL=1
```

作用：

- `BUN_VERSION` 固定 Bun 版本。
- `VP_GIT_HOOKS=0` 阻止 `prepare` 安装 Git hook。
- `SKIP_DEPENDENCY_INSTALL=1` 阻止平台重复安装依赖。

保存并触发部署。之后每次推送到 `main` 都会重新构建文档站。

Cloudflare Pages 会自动处理无扩展名路径。请求 `/guide/install` 时，返回 `guide/install.html`。请求 `.html` 时，重定向到无扩展名路径。

构建镜像文档：<https://developers.cloudflare.com/pages/configuration/build-image/>。

### 命令行上传

安装并登录 Wrangler 后：

```sh
bun run docs:build
bunx wrangler@latest pages deploy docs-user-build --project-name <项目名>
```

首次使用先运行 `bunx wrangler login`。

## 域名

生产域名：

```text
pis.modyqyw.top
```

域名和 HTTPS 在 Cloudflare 控制台中设置。不得在文档中写临时的预览域名。

`sitemap.xml` 的 `<loc>` 使用 `https://pis.modyqyw.top`。不得手动修改构建产物。

## 上线验证

部署完成后检查：

1. `https://pis.modyqyw.top/` 返回 200。
2. `/guide/install` 直接返回 200。
3. `/guide/interface` 显示界面说明。
4. `/reference/data` 显示数据和隐私说明。
5. `/icon.png` 显示浅色 Logo。
6. `/icon-dark.png` 显示深色 Logo。
7. `/sitemap.xml` 存在，`<loc>` 使用生产域名。
8. 不存在的路径显示 `404.html`。
9. 切换明暗主题，Logo 跟随变化。
10. 检查代码块、图片、中文文本和搜索入口。

检查关键 URL：

```sh
for path in / /guide/install /guide/interface /reference/data /icon.png /icon-dark.png /sitemap.xml; do
  curl -fsS -o /dev/null "https://pis.modyqyw.top${path}" || exit 1
done
```

命令只检查 HTTP 状态。页面内容仍需人工检查。

## 更新文档

文档改动后：

1. 运行 `bun run format`。
2. 运行 `bun run check`。
3. 运行 `bun run docs:build`。
4. 本地预览并检查页面。
5. 推送 `main`，等待 Cloudflare Pages 部署。
6. 执行上线验证。

手动上传时，重复第 3 步和第 5 步，并上传新的 `docs-user-build/`。

Cloudflare Pages 保留部署历史。需要回滚时，选择上一个成功部署。

## 内容规则

- `docs-user/` 只写用户行为。
- 不得把架构、开发、发布或部署说明放进用户指南。
- 用户指南的图片放在 `docs-user/public/images/`。
- 新增或移动页面时，更新 `rspress.config.ts` 的导航和侧边栏。
- 链接使用站内路径，例如 `/guide/install`。
- 移动页面后，搜索整个仓库中的旧路径。
- 开发者内容写入 `docs-dev/`。`docs-dev/` 不参与 Rspress 构建。

## 限制

- 只部署到 Cloudflare Pages。
- 只使用 `https://pis.modyqyw.top`。
- 站点使用根路径部署。
- 不配置第二域名和 canonical URL。
- 本文不配置访问控制。
- 本文不覆盖服务端函数、重定向和动态内容。
- 平台界面名称会变化，以当前界面为准。

## 相关文档

- [本地开发](./development.zh.md)
- [构建、签名与发布](./release.zh.md)
- [用户指南](../docs-user/zh/index.md)
