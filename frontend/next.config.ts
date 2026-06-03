import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle for a small production image.
  output: "standalone",
};

export default nextConfig;
