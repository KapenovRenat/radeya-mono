import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shared отдаёт TypeScript-исходники — Next должен их сам транспилировать.
  transpilePackages: ["@radeya/shared"],
};

export default nextConfig;
