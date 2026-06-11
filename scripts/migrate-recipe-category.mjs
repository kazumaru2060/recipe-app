import { createClient } from '@libsql/client'
import 'dotenv/config'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// SQLiteではALTER TABLE ADD COLUMNでNOT NULLは使えないためDEFAULTのみ指定
try {
  await client.execute(`ALTER TABLE "Recipe" ADD COLUMN "category" TEXT DEFAULT '通常料理'`)
  console.log('✓ Recipe に category カラムを追加しました')
} catch (e) {
  const msg = String(e)
  if (msg.includes('duplicate column') || msg.includes('already exists')) {
    console.log('✓ category カラムは既に存在します（スキップ）')
  } else {
    console.error('✗ エラー:', e)
    process.exit(1)
  }
}

// 既存レコードのcategoryがNULLの場合はデフォルト値を設定
const updated = await client.execute(
  `UPDATE "Recipe" SET "category" = '通常料理' WHERE "category" IS NULL`
)
console.log(`✓ NULLレコードを '通常料理' に設定しました（${updated.rowsAffected}件）`)

console.log('\n✅ 完了')
