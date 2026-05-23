import "dotenv/config";
import { defineConfig } from "prisma/config";

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoToken = process.env.TURSO_AUTH_TOKEN

// Prisma CLI は https:// 形式が必要（libsql:// を https:// に変換）
function getMigrateUrl() {
  if (!tursoUrl) return "file:./dev.db"
  const httpsUrl = tursoUrl.replace(/^libsql:\/\//, "https://")
  return tursoToken ? `${httpsUrl}?authToken=${tursoToken}` : httpsUrl
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getMigrateUrl(),
  },
});
