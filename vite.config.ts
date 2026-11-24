import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    printWidth: 100,
    singleQuote: false,
    semi: true,
    trailingComma: "all",
    ignorePatterns: [
      "build/**",
      ".mygo/**",
      "frontend/dist/**",
      "frontend/src/mygo.ts",
      "user-docs/**",
      "dev-docs/**",
      "user-docs-build/**",
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
      "user-docs/**",
      "dev-docs/**",
      "user-docs-build/**",
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
