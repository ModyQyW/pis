import { defineConfig } from "mygo-cli";

export default defineConfig({
  name: "Pi Mygo",
  identifier: "dev.pimygo.app",
  version: "0.1.0",
  devUrl: "http://localhost:5173",
  devCommand: "bun run dev:web",
  buildCommand: "bun run build:web",
  frontendDist: "frontend/dist",
  bindings: "frontend/src/mygo.ts",
  out: "build",
});
