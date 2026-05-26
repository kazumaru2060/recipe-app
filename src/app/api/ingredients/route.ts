import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

function parseNutrition(body: Record<string, unknown>) {
  const n = (k: string) => body[k] != null && body[k] !== '' ? parseFloat(body[k] as string) : null
  return {
    kcal: n('kcal'), protein: n('protein'), fat: n('fat'), carbs: n('carbs'),
    fiber: n('fiber'), calcium: n('calcium'), iron: n('iron'),
    vitA: n('vitA'), vitB1: n('vitB1'), vitB2: n('vitB2'),
    vitC: n('vitC'), vitD: n('vitD'), vitE: n('vitE'), salt: n('salt'),
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') ?? ''

  const ingredients = await prisma.ingredient.findMany({
    where: query ? { name: { contains: query } } : undefined,
    orderBy: { name: 'asc' },
  })

  return Response.json(ingredients)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, unit, pricePerUnit, tspGrams } = body

  if (!name || !unit || pricePerUnit == null) {
    return Response.json({ error: '名前、単位、単価は必須です' }, { status: 400 })
  }

  const existing = await prisma.ingredient.findUnique({ where: { name } })
  if (existing) {
    return Response.json({ error: 'すでに同じ名前の食材が登録されています' }, { status: 409 })
  }

  const tsp = tspGrams != null ? parseFloat(tspGrams) : null
  const ingredient = await prisma.ingredient.create({
    data: {
      name, unit, pricePerUnit: parseFloat(pricePerUnit),
      tspGrams: tsp,
      tbspGrams: tsp != null ? tsp * 3 : null,
      ...parseNutrition(body),
    },
  })

  return Response.json(ingredient, { status: 201 })
}
