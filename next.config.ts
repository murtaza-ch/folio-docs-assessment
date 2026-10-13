import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/documents/*/export": ["./app/fonts/*.ttf"],
  },
};
export default nextConfig;
