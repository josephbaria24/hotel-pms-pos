import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const isElectronBuild = process.env.ELECTRON_BUILD === "true";

// In Electron production builds we don't need the PORT env var — the app
// is served from disk via file:// so Vite's dev server is not involved.
// In web mode (Replit), PORT and BASE_PATH are required.
let port: number | undefined;
let basePath: string;

if (isElectronBuild) {
  // Electron build: use relative paths so file:// works
  basePath = "./";
} else {
  const rawPort = process.env.PORT;
  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }
  port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const rawBase = process.env.BASE_PATH;
  if (!rawBase) {
    throw new Error(
      "BASE_PATH environment variable is required but was not provided.",
    );
  }
  basePath = rawBase;
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(isElectronBuild ? [] : [runtimeErrorOverlay()]),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined &&
    !isElectronBuild
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "PetroCoreX-Next", "attached_assets"),
      "@tanstack/react-query": path.resolve(import.meta.dirname, "node_modules", "@tanstack", "react-query"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: port
    ? {
        port,
        host: "0.0.0.0",
        allowedHosts: true,
        fs: {
          strict: true,
          deny: ["**/.*"],
        },
      }
    : {},
  preview: port
    ? {
        port,
        host: "0.0.0.0",
        allowedHosts: true,
      }
    : {},
});
