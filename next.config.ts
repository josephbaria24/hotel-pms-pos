import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@workspace/api-client-react": path.resolve(
        __dirname,
        "src/lib/api-client/index.ts",
      ),
      wouter: path.resolve(__dirname, "src/lib/wouter-shim.tsx"),
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      "@workspace/api-client-react": "./src/lib/api-client/index.ts",
      wouter: "./src/lib/wouter-shim.tsx",
    },
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
