import { createClient } from '@libsql/client'

export async function GET() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  try {
    await client.execute(`ALTER TABLE "RecipeVersion" ADD COLUMN "referenceUrl" TEXT`)
    return Response.json({ ok: true, message: 'referenceUrl カラムを追加しました' })
  } catch (e) {
    const msg = String(e)
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      return Response.json({ ok: true, message: 'カラムは既に存在します' })
    }
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
