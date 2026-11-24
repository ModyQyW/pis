# 部署文档站

本文说明如何把 `docs-user-build/` 部署到 Cloudflare Pages 和 Netlify。本文只覆盖静态文档站。应用构建、签名和 Release 见[构建、签名与发布](/advanced/release)。

## 术语

- **文档站**：`docs-user/` 生成的 Rspress 静态站点。
- **构建产物**：`docs-user-build/` 目录。
- **手动上传**：在本地构建，再把构建产物上传到平台。
- **Git 集成**：平台拉取仓库，并在平台构建环境运行构建命令。

## 共同条件

- 本地必须安装 Bun 1.4.5。
- 仓库根目录是项目根目录。
- 构建命令必须执行 `bun run docs:build`。
- 输出目录必须是 `docs-user-build`。
- 文档站使用根路径 `/`。本文不覆盖子路径部署。
- 生产构建必须设置 `PIS_DOCS_SITE_URL`。该变量写入 sitemap 的绝对 URL。
- 两个平台各用自己的公开 URL。不要用同一个 sitemap URL 指向两个域名。
- 文档站不需要 Go 和 pi。
- 文档站是静态站点。Cloudflare 和 Netlify 不需要启动服务器。
- `docs-user-build/` 不进入 Git。

## 1. 本地构建

在仓库根目录执行：

```sh
bun install --frozen-lockfile
PIS_DOCS_SITE_URL=https://<site-host> bun run docs:build
```

把 `<site-host>` 替换为本次部署的公开域名。Cloudflare Pages 和 Netlify 使用不同域名时，各构建一次。

构建成功后检查以下文件：

```text
docs-user-build/index.html
docs-user-build/404.html
docs-user-build/sitemap.xml
docs-user-build/icon.png
docs-user-build/icon-dark.png
```

执行预览：

```sh
bun run docs:preview
```

打开终端显示的本地地址。检查首页、指南、进阶、参考、明暗 Logo 和图片。检查完成后停止预览进程。

## 2. 部署到 Cloudflare Pages

### 2.1 手动上传（推荐）

1. 在本地执行第 1 节的构建命令。
2. 打开 Cloudflare Dashboard。
3. 进入 `Workers & Pages`。
4. 选择 `Create`，再选择 `Pages`。
5. 选择 `Upload assets`。
6. 填写项目名称。项目名称确定后不要随意修改。
7. 选择 `docs-user-build/` 目录并上传。
8. 等待部署完成。Cloudflare 会返回公开 URL。
9. 执行第 4 节的验证。

手动上传不需要设置构建环境。每次修改文档后，重新构建并上传新产物。

### 2.2 Git 集成

1. 在 Cloudflare Pages 中连接 GitHub 仓库 `ModyQyW/pis`。
2. 将 Framework preset 设为 `None`。
3. 将 Root directory 设为 `/`。
4. 将 Build command 设为：

```sh
bun install --frozen-lockfile && bun run docs:build
```

5. 将 Build output directory 设为 `docs-user-build`。
6. 添加以下环境变量。

```text
BUN_VERSION=1.4.5
PIS_DOCS_SITE_URL=https://<cloudflare-site-host>
VP_GIT_HOOKS=0
SKIP_DEPENDENCY_INSTALL=1
```

`BUN_VERSION` 固定 Bun 版本。Cloudflare Pages 当前默认 Bun 1.4.4。项目使用 Bun 1.4.5。`PIS_DOCS_SITE_URL` 写入该站点的 sitemap。`VP_GIT_HOOKS=0` 阻止 `prepare` 安装 Git hook。`SKIP_DEPENDENCY_INSTALL=1` 阻止平台重复安装依赖。

7. 保存设置并触发部署。
8. 执行第 4 节的验证。

Cloudflare Pages 会自动处理无扩展名的 HTML 路径。请求 `/guide/getting-started` 时，Pages 返回 `guide/getting-started.html`。`.html` 请求会重定向到无扩展名路径。

Cloudflare 的构建镜像文档见 <https://developers.cloudflare.com/pages/configuration/build-image/>。

### 2.3 命令行上传（可选）

如果安装并登录 Wrangler，可以在本地执行：

```sh
bun run docs:build
bunx wrangler@latest pages deploy docs-user-build --project-name <pages-project-name>
```

`<pages-project-name>` 必须替换为已有 Pages 项目名。首次使用 Wrangler 时，先执行 `bunx wrangler login`。

## 3. 部署到 Netlify

### 3.1 手动上传（推荐）

1. 在本地执行第 1 节的构建命令。
2. 打开 Netlify Dashboard。
3. 选择 `Add new site`，再选择 `Deploy manually`。
4. 将 `docs-user-build/` 目录拖入上传区域。
5. 等待部署完成。Netlify 会返回公开 URL。
6. 在 Netlify 站点配置中打开 Post processing。
7. 确认或启用 Pretty URLs。Rspress 生成的链接不带 `.html`。
8. 重新部署。设置变更需要新部署才能生效。
9. 执行第 4 节的验证。

手动上传不读取 Git integration 的构建设置。每次修改文档后，重新构建并上传新产物。

### 3.2 Git 集成

仓库不包含 `netlify.toml`。以下设置写在 Netlify 站点配置中。

1. 在 Netlify 中连接 GitHub 仓库 `ModyQyW/pis`。
2. 确认 Base directory 为仓库根目录。
3. 在 Netlify 站点配置中打开 Post processing。
4. 确认或启用 Pretty URLs。Rspress 生成的链接不带 `.html`。
5. 将 Build command 设为：

```sh
bun install --frozen-lockfile && bun run docs:build
```

6. 将 Publish directory 设为 `docs-user-build`。
7. 将环境变量 `BUN_VERSION` 设为 `1.4.5`。
8. 将环境变量 `PIS_DOCS_SITE_URL` 设为该站点的公开域名。
9. 触发部署。
10. 执行第 4 节的验证。

Netlify 文档当前只列出 `bun.lockb` 的自动检测。本仓库使用 `bun.lock`。因此 Netlify 会先运行一次 `npm install`。然后 Netlify 执行站点配置中的 build command。

如果这次 `npm install` 失败，Netlify 不会执行 build command。此时请使用第 3.1 节的手动上传。不要为部署新增重复的 `bun.lockb`。

Netlify 的 Bun 版本设置见 <https://docs.netlify.com/build/configure-builds/available-software-at-build-time/>。

### 3.3 命令行上传（可选）

如果安装并登录 Netlify CLI，可以在本地执行：

```sh
bun run docs:build
bunx netlify-cli@latest deploy --prod --dir docs-user-build
```

首次使用 Netlify CLI 时，先执行 `bunx netlify-cli@latest login`。

## 4. 上线验证

部署完成后逐项检查：

1. 打开站点首页。页面必须返回 `200`。
2. 打开 `/guide/getting-started`。页面必须直接返回 `200`，不得跳转到 404。
3. 打开 `/advanced/architecture`。页面必须显示架构说明。
4. 打开 `/reference/configuration`。页面必须显示配置表。
5. 打开 `/icon.png`。必须显示白色背景 Logo。
6. 打开 `/icon-dark.png`。必须显示黑色背景 Logo。
7. 打开 `/sitemap.xml`。文件必须存在，`<loc>` 必须是绝对 URL。
8. 打开一个不存在的路径。站点必须显示文档站的 `404.html`。
9. 切换明暗主题。导航栏 Logo 必须随主题变化。
10. 检查代码块、图片、中文文本和搜索入口。

可以用以下命令检查关键 URL：

```sh
for path in / /guide/getting-started /advanced/architecture /reference/configuration /icon.png /icon-dark.png /sitemap.xml; do
  curl -fsS -o /dev/null "https://<site-host>${path}" || exit 1
done
```

把 `<site-host>` 替换为实际域名。该命令只检查 HTTP 状态。页面内容仍必须人工检查。

## 5. 更新流程

文档改动后按以下顺序执行：

1. 运行 `bun run format`。
2. 运行 `bun run check`。
3. 用目标站点的 `PIS_DOCS_SITE_URL` 运行 `bun run docs:build`。
4. 在本地执行 `bun run docs:preview` 并检查页面。
5. 上传新的 `docs-user-build/`。
6. 执行第 4 节的验证。

两个平台使用不同域名时，第 3 步和第 5 步各执行两次。第二次构建前不要复用第一次的目录。

Cloudflare Pages 和 Netlify 都保留部署历史。需要回滚时，在平台中选择上一个成功部署。本文不配置自动部署。部署动作由维护者手动执行。

## 6. 限制

- 本文只覆盖根路径部署。
- 两个平台需要分别设置 `PIS_DOCS_SITE_URL`。
- 两个域名显示相同内容。本文不配置 canonical URL。需要 canonical URL 时，先选定一个主域名。
- Netlify 的 Pretty URLs 必须启用。未启用时，无 `.html` 的页面路径会返回 404。
- 本文不配置自定义域名。域名和 HTTPS 在平台控制台中设置。
- 本文不配置访问控制。文档站是公开站点。
- 本文不覆盖服务端函数、重定向规则和动态内容。
- Netlify Git 集成的首次 `npm install` 由 Netlify 执行。该步骤不受站点 Build command 控制。
- Cloudflare Pages 和 Netlify 的界面名称会变化。以平台当前界面为准。
