import { NextRequest } from 'next/server'
import { put } from '@vercel/blob'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return Response.json({ error: 'ファイルが見つかりません' }, { status: 400 })
  }

  // Vercel 本番環境では Vercel Blob を使用、ローカルではファイル保存
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const filename = `recipes/${Date.now()}.${ext}`
    const blob = await put(filename, file, { access: 'public' })
    return Response.json({ path: blob.url })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  await mkdir(uploadsDir, { recursive: true })
  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  await writeFile(path.join(uploadsDir, filename), buffer)
  return Response.json({ path: `/uploads/${filename}` })
}
