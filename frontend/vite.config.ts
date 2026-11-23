import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // The mygo dev app and packaged builds are not page sources.
    watch: { ignored: ["**/.mygo/**", "**/build/**", "**/dist/**"] },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "safari18",
    // Production ships no source maps: they add ~21 MB to the embedded app and
    // are not useful without the original dev tree.
    sourcemap: false,
  },
});
