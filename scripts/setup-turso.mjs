import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !authToken) {
  console.error('TURSO_DATABASE_URL と TURSO_AUTH_TOKEN を .env に設定してください')
  process.exit(1)
}

const client = createClient({ url, authToken })

const statements = [
  `CREATE TABLE IF NOT EXISTS "Ingredient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "pricePerUnit" REAL NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Ingredient_name_key" ON "Ingredient"("name")`,
  `CREATE TABLE IF NOT EXISTS "Recipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "photoPath" TEXT,
    "referenceUrl" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE TABLE IF NOT EXISTS "RecipeVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipeId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "notes" TEXT,
    "steps" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RecipeVersion_recipeId_versionNumber_key" ON "RecipeVersion"("recipeId", "versionNumber")`,
  `CREATE TABLE IF NOT EXISTS "RecipeIngredient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipeVersionId" INTEGER NOT NULL,
    "ingredientId" INTEGER,
    "customName" TEXT,
    "amount" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "manualCost" REAL,
    FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE,
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
  )`,
]

console.log('Turso データベースにテーブルを作成中...')
for (const sql of statements) {
  await client.execute(sql)
}
console.log('✓ テーブルの作成が完了しました！')
