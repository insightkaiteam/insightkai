import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 1. Fix for standard Webpack builds */
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

  /* 2. Fix for Turbopack (moved to top level) */
  turbo: {
    resolveAlias: {
      canvas: 'empty',
    },
  },
};

export default nextConfig;