import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const recipe = await prisma.recipe.findUnique({
    where: { id: parseInt(id) },
    include: {
      versions: {
        orderBy: { versionNumber: 'asc' },
        include: { ingredients: { include: { ingredient: true } } },
      },
    },
  })

  if (!recipe) {
    return Response.json({ error: 'レシピが見つかりません' }, { status: 404 })
  }

  return Response.json(recipe)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { name, description, photoPath, referenceUrl } = body

  const recipe = await prisma.recipe.update({
    where: { id: parseInt(id) },
    data: {
      name,
      description: description ?? null,
      photoPath: photoPath ?? null,
      referenceUrl: referenceUrl ?? null,
    },
  })

  return Response.json(recipe)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await prisma.recipe.delete({ where: { id: parseInt(id) } })

  return Response.json({ success: true })
}
