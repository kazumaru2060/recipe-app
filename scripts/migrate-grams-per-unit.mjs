import { createClient } from '@libsql/client'
import 'dotenv/config'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

try {
  await client.execute(`ALTER TABLE "Ingredient" ADD COLUMN "gramsPerUnit" REAL`)
  console.log('✓ Ingredient に gramsPerUnit カラムを追加しました')
} catch {
  console.log('✓ gramsPerUnit カラムは既に存在します（スキップ）')
}

console.log('\n✅ 完了')
