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
  const { name, description, photoPath, referenceUrl, category, steps, ingredients, versionId, versionPhotoPath } = body

  const recipeId = parseInt(id)

  // レシピ基本情報を更新
  await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      name,
      description: description ?? null,
      photoPath: photoPath ?? null,
      referenceUrl: referenceUrl ?? null,
      ...(category !== undefined && { category }),
    },
  })

  // 指定バージョンの材料・手順を更新
  if (steps !== undefined && ingredients !== undefined && versionId) {
    const targetVersionId = parseInt(versionId)

    // 既存の材料を削除して新しい材料で置き換え
    await prisma.recipeIngredient.deleteMany({
      where: { recipeVersionId: targetVersionId },
    })

    await prisma.recipeVersion.update({
      where: { id: targetVersionId },
      data: {
        steps: JSON.stringify(steps),
        ...(versionPhotoPath !== undefined && { photoPath: versionPhotoPath ?? null }),
      },
    })

    if (ingredients.length > 0) {
      await prisma.recipeIngredient.createMany({
        data: (ingredients as {
          ingredientId?: number | null
          customName?: string | null
          amount: number
          unit: string
          manualCost?: number | null
          sectionName?: string | null
        }[]).map(ing => ({
          recipeVersionId: targetVersionId,
          ingredientId: ing.ingredientId ?? null,
          customName: ing.customName ?? null,
          amount: ing.amount,
          unit: ing.unit,
          manualCost: ing.manualCost ?? null,
          sectionName: ing.sectionName ?? null,
        })),
      })
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
