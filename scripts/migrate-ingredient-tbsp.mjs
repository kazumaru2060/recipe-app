import { createClient } from '@libsql/client'
import 'dotenv/config'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

for (const col of ['tbspGrams', 'tspGrams']) {
  try {
    await client.execute(`ALTER TABLE "Ingredient" ADD COLUMN "${col}" REAL`)
    console.log(`✓ Ingredient に ${col} カラムを追加しました`)
  } catch {
    console.log(`✓ ${col} カラムは既に存在します（スキップ）`)
  }
}
