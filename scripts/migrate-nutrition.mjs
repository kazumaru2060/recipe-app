import { createClient } from '@libsql/client'
import 'dotenv/config'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const columns = [
  'kcal',     // エネルギー (kcal/100g)
  'protein',  // たんぱく質 (g/100g)
  'fat',      // 脂質 (g/100g)
  'carbs',    // 炭水化物 (g/100g)
  'fiber',    // 食物繊維 (g/100g)
  'calcium',  // カルシウム (mg/100g)
  'iron',     // 鉄 (mg/100g)
  'vitA',     // ビタミンA レチノール活性当量 (μg/100g)
  'vitB1',    // ビタミンB1 (mg/100g)
  'vitB2',    // ビタミンB2 (mg/100g)
  'vitC',     // ビタミンC (mg/100g)
  'vitD',     // ビタミンD (μg/100g)
  'vitE',     // ビタミンE αトコフェロール (mg/100g)
  'salt',     // 食塩相当量 (g/100g)
]

for (const col of columns) {
  try {
    await client.execute(`ALTER TABLE "Ingredient" ADD COLUMN "${col}" REAL`)
    console.log(`✓ Ingredient に ${col} カラムを追加しました`)
  } catch {
    console.log(`✓ ${col} カラムは既に存在します（スキップ）`)
  }
}

console.log('\n✅ 栄養素カラムの追加が完了しました')
