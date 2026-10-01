import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sitio estático: no hay servidor Next (ver CLAUDE.md).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
