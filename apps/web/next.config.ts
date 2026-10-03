import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(appDir, "../.."),
  transpilePackages: ["@heybit/shared"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    const extra = ["pino-pretty", "lokijs", "encoding"];
    if (Array.isArray(config.externals)) {
      config.externals.push(...extra);
    } else if (config.externals) {
      config.externals = [config.externals, ...extra];
    } else {
      config.externals = extra;
    }
    return config;
  },
};

export default nextConfig;
