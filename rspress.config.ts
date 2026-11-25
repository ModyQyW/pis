import { defineConfig } from "@rspress/core";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: "docs-user",
  outDir: "docs-user-build",
  globalStyles: fileURLToPath(new URL("docs-user/styles/index.css", import.meta.url)),
  lang: "en",
  title: "PiS",
  description: "PiS is a desktop coding agent shell for pi.",
  locales: [
    {
      lang: "en",
      label: "English",
      title: "PiS",
      description:
        "PiS is a desktop coding agent shell for pi: native window, streaming sessions, approvals, and plan mode.",
    },
    {
      lang: "zh",
      label: "简体中文",
      title: "PiS",
      description: "PiS 是 pi 的桌面外壳：原生窗口、流式会话、审批与计划模式。",
    },
  ],
  siteOrigin: "https://pis.modyqyw.top",
  logo: {
    light: "/icon.png",
    dark: "/icon-dark.png",
    width: 26,
    height: 26,
  },
  logoText: "PiS",
  head: [["link", { rel: "icon", href: "/icon.png" }]],
  themeConfig: {
    footer: {
      message: "PiS · MIT License",
    },
  },
});
