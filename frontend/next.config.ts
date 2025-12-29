import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 1. Fix for standard Webpack builds (Standard Build) */
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

  /* 2. Fix for Next.js 16 Turbopack (Renamed from 'turbo' to 'turbopack') */
  turbopack: {
    resolveAlias: {
      canvas: 'empty',
    },
  },
};

export default nextConfig;