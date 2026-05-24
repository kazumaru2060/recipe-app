import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// ホームに表示するカバー写真を更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { photoPath } = await request.json()

  const recipe = await prisma.recipe.update({
    where: { id: parseInt(id) },
    data: { photoPath: photoPath ?? null },
  })

  return Response.json(recipe)
}
