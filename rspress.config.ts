import { defineConfig } from "@rspress/core";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: "user-docs",
  outDir: "user-docs-build",
  globalStyles: fileURLToPath(new URL("user-docs/styles/index.css", import.meta.url)),
  title: "PiS",
  description: "PiS 是一个建立在 pi 之上的桌面 Coding Agent：原生外壳、流式会话、审批与计划模式。",
  logo: "/icon.png",
  logoText: "PiS",
  head: [["link", { rel: "icon", href: "/icon.png" }]],
  themeConfig: {
    nav: [
      { text: "指南", link: "/guide/getting-started" },
      { text: "进阶", link: "/advanced/architecture" },
      { text: "参考", link: "/reference/configuration" },
      { text: "GitHub", link: "https://github.com/ModyQyW/pis" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "开始使用",
          items: [
            { text: "安装与第一次运行", link: "/guide/getting-started" },
            { text: "日常使用", link: "/guide/daily-use" },
          ],
        },
        {
          text: "控制与扩展",
          items: [
            { text: "信任、审批与计划模式", link: "/guide/approvals" },
            { text: "使用 pi 扩展", link: "/guide/extensions" },
            { text: "设置与数据", link: "/guide/settings" },
          ],
        },
      ],
      "/advanced/": [
        {
          text: "深入理解",
          items: [
            { text: "架构与数据流", link: "/advanced/architecture" },
            { text: "本地开发", link: "/advanced/development" },
            { text: "构建、签名与发布", link: "/advanced/release" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "参考",
          items: [
            { text: "环境变量与目录", link: "/reference/configuration" },
            { text: "故障排查", link: "/reference/troubleshooting" },
          ],
        },
      ],
    },
    footer: {
      message: "PiS · MIT License · 基于 mygo 与 pi",
    },
  },
});
