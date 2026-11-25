# Documentation site

[English](docs-site.md) | [简体中文](docs-site.zh.md)

The user guide is built from `docs-user/` and deployed at:

```text
https://pis.modyqyw.top
```

Developer documentation is not part of the site. This page explains how to build, deploy, and check the site.

## Terms

- Documentation site: the Rspress static site built from `docs-user/`.
- Build output: the `docs-user-build/` directory.
- Manual upload: build locally and upload the output.
- Git integration: Cloudflare Pages pulls the repository and runs the build command.

## Conditions

- Bun 1.4.5 on the local machine.
- Run the build from the repository root.
- The build command is `bun run docs:build`.
- The output directory is `docs-user-build`.
- The site uses the root path `/`.
- The production domain is `https://pis.modyqyw.top`.
- `siteOrigin` is set in `rspress.config.ts` for the sitemap.
- The site needs no Go and no pi.
- `docs-user-build/` is not committed.

## Local build

```sh
bun install --frozen-lockfile
bun run docs:build
```

Check the output:

```text
docs-user-build/index.html
docs-user-build/404.html
docs-user-build/sitemap.xml
docs-user-build/icon.png
docs-user-build/icon-dark.png
```

Preview locally:

```sh
bun run docs:preview
```

Open the address in the terminal. Check:

- The home page and navigation.
- Guide pages in English and Chinese.
- Reference pages.
- Light and dark logos.
- Images and code blocks.
- The language switcher.

Stop the preview process after the check.

## Deploy to Cloudflare Pages

### Manual upload

1. Build locally.
2. Open the Cloudflare Dashboard.
3. Open Workers & Pages.
4. Select the existing PiS Pages project.
5. Select Create deployment.
6. Upload `docs-user-build/`.
7. Wait for the deployment.
8. Open `https://pis.modyqyw.top`.
9. Run the [post-deploy check](#post-deploy-check).

After a documentation change, build and upload again.

Manual upload does not change the Git integration settings. Do not use both methods for the same deployment.

### Git integration

The Cloudflare Pages project connects to the GitHub repository `ModyQyW/pis`.

Settings:

| Setting | Value |
|---|---|
| Framework preset | `None` |
| Root directory | `/` |
| Build command | `bun install --frozen-lockfile && bun run docs:build` |
| Build output directory | `docs-user-build` |

Environment variables:

```text
BUN_VERSION=1.4.5
VP_GIT_HOOKS=0
SKIP_DEPENDENCY_INSTALL=1
```

Purpose:

- `BUN_VERSION` fixes the Bun version.
- `VP_GIT_HOOKS=0` stops `prepare` from installing a Git hook.
- `SKIP_DEPENDENCY_INSTALL=1` stops the platform from installing dependencies again.

Save the settings and start a deployment. After that, every push to `main` rebuilds the site.

Cloudflare Pages handles extensionless paths. A request for `/guide/install` returns `guide/install.html`. A request for `.html` redirects to the extensionless path.

Build image documentation: <https://developers.cloudflare.com/pages/configuration/build-image/>.

### Command-line upload

Install and sign in to Wrangler:

```sh
bun run docs:build
bunx wrangler@latest pages deploy docs-user-build --project-name <project-name>
```

Run `bunx wrangler login` first.

## Domain

Production domain:

```text
pis.modyqyw.top
```

Set the domain and HTTPS in the Cloudflare console. Do not put a temporary preview domain in the documentation.

The `<loc>` values in `sitemap.xml` use `https://pis.modyqyw.top`. Do not edit the build output by hand.

## Post-deploy check

After deployment:

1. `https://pis.modyqyw.top/` returns 200.
2. `/guide/install` returns 200.
3. `/zh/guide/install` returns 200 and shows Chinese text.
4. `/reference/data` shows the data and privacy page.
5. `/icon.png` shows the light logo.
6. `/icon-dark.png` shows the dark logo.
7. `/sitemap.xml` exists and `<loc>` uses the production domain.
8. An unknown path shows `404.html`.
9. The theme switch changes the logo.
10. Code blocks, images, both languages, and search work.

Check the key URLs:

```sh
for path in / /guide/install /zh/guide/install /reference/data /icon.png /icon-dark.png /sitemap.xml; do
  curl -fsS -o /dev/null "https://pis.modyqyw.top${path}" || exit 1
done
```

The command checks HTTP status only. Check page content by hand.

## Update the docs

After a documentation change:

1. Run `bun run format`.
2. Run `bun run check`.
3. Run `bun run docs:build`.
4. Preview and check both languages.
5. Push `main` and wait for Cloudflare Pages.
6. Run the post-deploy check.

For a manual upload, repeat step 3 and step 5, then upload the new `docs-user-build/`.

Cloudflare Pages keeps deployment history. To roll back, select the last successful deployment.

## Content rules

- `docs-user/` covers user behavior only.
- Do not put architecture, development, release, or deployment notes in the user guide.
- User pages live in `docs-user/en/` and `docs-user/zh/`.
- User screenshots go in `docs-user/public/images/`.
- Update `docs-user/en/_nav.json`, `docs-user/zh/_nav.json`, and the `_meta.json` files when you add or move a page.
- User links use site paths such as `/guide/install`.
- Rspress adds `/zh` for Chinese pages.
- Developer content goes in `docs-dev/`. `docs-dev/` is not part of the Rspress build.

## Limits

- Deploy only to Cloudflare Pages.
- Use only `https://pis.modyqyw.top`.
- The site uses root-path deployment.
- No second domain and no canonical URL.
- This page does not configure access control.
- This page does not cover server functions, redirects, or dynamic content.
- Platform interface names can change. Use the current interface.

## Related

- [Local development](development.md)
- [Build, sign, and release](release.md)
- [User guide](../docs-user/en/index.md)
