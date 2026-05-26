import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  serverExternalPackages: ["oracledb", "ssh2"],
  reactCompiler: true,
};

export default nextConfig;
