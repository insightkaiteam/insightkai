import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // This ignores the 'canvas' module which causes the pdfjs-dist build error
    config.resolve.alias.canvas = false;
    return config;
  },
  // If you are using Turbopack, you may need this addition for experimental support
  experimental: {
    turbo: {
      resolveAlias: {
        canvas: false,
      },
    },
  },
};

export default nextConfig;