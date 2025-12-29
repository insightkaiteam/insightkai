import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // This tells Webpack to ignore the canvas module completely
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;