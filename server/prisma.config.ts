import { config as loadEnvFile } from "dotenv";
import { defineConfig } from "prisma/config";

// Единый .env лежит в корне монорепозитория. Prisma CLI всегда запускается
// с cwd = server/ (иначе не найдёт этот конфиг), поэтому путь относительный.
loadEnvFile({ path: "../.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
