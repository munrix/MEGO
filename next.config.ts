import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // native module — must stay external to the server bundle
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
