import path from "node:path";

import { config as loadEnvFile } from "dotenv";
import type { NextConfig } from "next";

// Единый .env лежит в корне монорепозитория, а Next читает переменные только
// из своей папки и вверх не поднимается — поэтому подгружаем файл явно.
// Путь считаем от __dirname, а не от cwd: результат не должен зависеть от того,
// из какой папки запущена команда.
loadEnvFile({ path: path.resolve(__dirname, "../.env") });

const nextConfig: NextConfig = {
  // shared отдаёт TypeScript-исходники — Next должен их сам транспилировать.
  transpilePackages: ["@radeya/shared"],
  turbopack: {
    rules: {
      "*.svg": { loaders: [
          {
            loader: "@svgr/webpack",
            options: {
              svgoConfig: {
                plugins: [
                  {
                    name: "preset-default",
                    params: { overrides: { removeViewBox: false } },
                  },
                ],
              },
            },
          },
        ],
        as: "*.js", },
    },
  },
};

export default nextConfig;
