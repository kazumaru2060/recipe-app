import { createClient } from '@libsql/client'
import 'dotenv/config'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

try {
  await client.execute(`ALTER TABLE "RecipeIngredient" ADD COLUMN "sectionName" TEXT`)
  console.log('✓ RecipeIngredient に sectionName カラムを追加しました')
} catch {
  console.log('✓ sectionName カラムは既に存在します（スキップ）')
}
console.log('マイグレーション完了！')
