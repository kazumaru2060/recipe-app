import { createClient } from '@libsql/client'
import 'dotenv/config'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

try {
  await client.execute(`ALTER TABLE "RecipeVersion" ADD COLUMN "referenceUrl" TEXT`)
  console.log('✓ RecipeVersion に referenceUrl カラムを追加しました')
} catch (e) {
  const msg = String(e)
  if (msg.includes('duplicate column') || msg.includes('already exists')) {
    console.log('✓ referenceUrl カラムは既に存在します（スキップ）')
  } else {
    console.error('✗ エラー:', e)
    process.exit(1)
  }
}

console.log('\n✅ 完了')
