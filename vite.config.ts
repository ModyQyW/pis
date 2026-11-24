import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [
      "build/**",
      ".mygo/**",
      "frontend/dist/**",
      "frontend/src/mygo.ts",
      "docs-user/**",
      "docs-dev/**",
      "docs-user-build/**",
      "frontend/public/**",
      "resources/**",
      "README.md",
      "CHANGELOG.md",
    ],
  },
  lint: {
    ignorePatterns: [
      "build/**",
      ".mygo/**",
      "frontend/dist/**",
      "frontend/src/mygo.ts",
      "docs-user/**",
      "docs-dev/**",
      "docs-user-build/**",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["frontend/src/components/ExtensionStatusRail.tsx"],
        rules: { "no-control-regex": "off" },
      },
    ],
  },
});
