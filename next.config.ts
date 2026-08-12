import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

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
