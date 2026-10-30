import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off for the MVP: every host/guest page reads live data,
  // so the classic dynamic-rendering model is simpler and good enough here.
  cacheComponents: false,
  // PGlite ships a WASM Postgres and must be loaded by Node, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
