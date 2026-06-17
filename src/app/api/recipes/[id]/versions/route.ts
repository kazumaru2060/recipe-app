import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { notes, ingredients, steps, photoPath, servings, servingsUnit } = body

  const recipeId = parseInt(id)

  const existing = await prisma.recipeVersion.findMany({
    where: { recipeId },
    orderBy: { versionNumber: 'desc' },
    take: 1,
  })

  const nextVersion = (existing[0]?.versionNumber ?? 0) + 1

  const version = await prisma.recipeVersion.create({
    data: {
      recipeId,
      versionNumber: nextVersion,
      notes: notes ?? null,
      steps: JSON.stringify(steps ?? []),
      photoPath: photoPath ?? null,
      servings: servings != null ? parseInt(servings) : null,
      servingsUnit: servingsUnit ?? null,
      ingredients: {
        create: (ingredients ?? []).map((ing: {
          ingredientId?: number
          customName?: string
          amount: number
          unit: string
          manualCost?: number
          sectionName?: string
        }) => ({
          ingredientId: ing.ingredientId ?? null,
          customName: ing.customName ?? null,
          amount: ing.amount,
          unit: ing.unit,
          manualCost: ing.manualCost ?? null,
          sectionName: ing.sectionName ?? null,
        })),
      },
    },
    include: {
      ingredients: { include: { ingredient: true } },
    },
  })

  return Response.json(version, { status: 201 })
}
