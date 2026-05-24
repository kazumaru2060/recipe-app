import { createClient } from '@libsql/client'
import 'dotenv/config'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !authToken) {
  console.error('TURSO_DATABASE_URL と TURSO_AUTH_TOKEN を .env に設定してください')
  process.exit(1)
}

const client = createClient({ url, authToken })

try {
  await client.execute(`ALTER TABLE "RecipeVersion" ADD COLUMN "photoPath" TEXT`)
  console.log('✓ RecipeVersion に photoPath カラムを追加しました')
} catch {
  console.log('✓ photoPath カラムは既に存在します（スキップ）')
}

console.log('マイグレーション完了！')
