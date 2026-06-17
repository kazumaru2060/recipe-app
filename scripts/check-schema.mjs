import { createClient } from '@libsql/client'
import 'dotenv/config'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const res = await client.execute('PRAGMA table_info("Recipe")')
console.log('Recipe columns:')
for (const row of res.rows) {
  console.log(`  ${row.name} (${row.type}) default=${row.dflt_value} notnull=${row.notnull}`)
}
