import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    inlineCss: true,
  },
  env: {
    CESIUM_BASE_URL: "https://cesium.com/downloads/cesiumjs/releases/1.138/Build/Cesium/",
  },
};

export default nextConfig;
