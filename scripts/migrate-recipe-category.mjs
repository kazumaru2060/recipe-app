import { createClient } from '@libsql/client'
import 'dotenv/config'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

try {
  await client.execute(`ALTER TABLE "Recipe" ADD COLUMN "category" TEXT NOT NULL DEFAULT '通常料理'`)
  console.log('✓ Recipe に category カラムを追加しました')
} catch {
  console.log('✓ category カラムは既に存在します（スキップ）')
}

console.log('\n✅ 完了')
