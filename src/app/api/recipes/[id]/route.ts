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
  const { name, description, photoPath, referenceUrl, steps, ingredients } = body

  const recipeId = parseInt(id)

  // レシピ基本情報を更新
  await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      name,
      description: description ?? null,
      photoPath: photoPath ?? null,
      referenceUrl: referenceUrl ?? null,
    },
  })

  // 最新バージョンの材料・手順を更新
  if (steps !== undefined && ingredients !== undefined) {
    const latestVersion = await prisma.recipeVersion.findFirst({
      where: { recipeId },
      orderBy: { versionNumber: 'desc' },
    })

    if (latestVersion) {
      // 既存の材料を削除して新しい材料で置き換え
      await prisma.recipeIngredient.deleteMany({
        where: { recipeVersionId: latestVersion.id },
      })

      await prisma.recipeVersion.update({
        where: { id: latestVersion.id },
        data: { steps: JSON.stringify(steps) },
      })

      if (ingredients.length > 0) {
        await prisma.recipeIngredient.createMany({
          data: (ingredients as {
            ingredientId?: number | null
            customName?: string | null
            amount: number
            unit: string
            manualCost?: number | null
          }[]).map(ing => ({
            recipeVersionId: latestVersion.id,
            ingredientId: ing.ingredientId ?? null,
            customName: ing.customName ?? null,
            amount: ing.amount,
            unit: ing.unit,
            manualCost: ing.manualCost ?? null,
          })),
        })
      }
    }
  }

  const updated = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      versions: {
        orderBy: { versionNumber: 'asc' },
        include: { ingredients: { include: { ingredient: true } } },
      },
    },
  })

  return Response.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await prisma.recipe.delete({ where: { id: parseInt(id) } })

  return Response.json({ success: true })
}
