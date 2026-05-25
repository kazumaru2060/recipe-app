import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function GET() {
  const recipes = await prisma.recipe.findMany({
    include: {
      versions: {
        orderBy: { versionNumber: 'asc' },
        include: { ingredients: { include: { ingredient: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return Response.json(recipes)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, description, photoPath, referenceUrl, ingredients, steps } = body

  if (!name) {
    return Response.json({ error: 'レシピ名は必須です' }, { status: 400 })
  }

  const recipe = await prisma.recipe.create({
    data: {
      name,
      description: description ?? null,
      photoPath: photoPath ?? null,
      referenceUrl: referenceUrl ?? null,
      versions: {
        create: {
          versionNumber: 1,
          steps: JSON.stringify(steps ?? []),
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
      },
    },
    include: {
      versions: {
        include: { ingredients: { include: { ingredient: true } } },
      },
    },
  })

  return Response.json(recipe, { status: 201 })
}
