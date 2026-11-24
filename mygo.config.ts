import { defineConfig } from "mygo-cli";

const signingIdentity = process.env.MACOS_SIGNING_IDENTITY;
const notaryProfile = process.env.MACOS_NOTARY_PROFILE;
const updatePublicKey = process.env.PIS_UPDATE_PUBLIC_KEY;
const updateURL = process.env.PIS_UPDATE_URL;
const updateGithub = process.env.PIS_UPDATE_GITHUB;

export default defineConfig({
  name: "PiS",
  slug: "pis",
  identifier: "top.modyqyw.pis",
  version: process.env.PIS_VERSION ?? "0.1.0",
  ...(updatePublicKey && (updateURL || updateGithub)
    ? {
        updates: {
          publicKey: updatePublicKey,
          ...(updateURL ? { url: updateURL } : { github: updateGithub }),
        },
      }
    : {}),
  ...(signingIdentity
    ? {
        macos: {
          signingIdentity,
          ...(notaryProfile ? { notarize: { keychainProfile: notaryProfile } } : {}),
        },
      }
    : {}),
  devUrl: "http://localhost:5173",
  devCommand: "bun run dev:web",
  buildCommand: "bun run build:web",
  frontendDist: "frontend/dist",
  bindings: "frontend/src/mygo.ts",
  out: "build",
});
