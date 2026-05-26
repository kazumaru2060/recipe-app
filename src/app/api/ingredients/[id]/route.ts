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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { name, unit, pricePerUnit, tspGrams } = body

  const tsp = tspGrams != null ? parseFloat(tspGrams) : null
  const gpu = body.gramsPerUnit != null && body.gramsPerUnit !== '' ? parseFloat(body.gramsPerUnit as string) : null
  const ingredient = await prisma.ingredient.update({
    where: { id: parseInt(id) },
    data: {
      name, unit, pricePerUnit: parseFloat(pricePerUnit),
      tspGrams: tsp,
      tbspGrams: tsp != null ? tsp * 3 : null,
      gramsPerUnit: gpu,
      ...parseNutrition(body),
    },
  })

  return Response.json(ingredient)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await prisma.ingredient.delete({ where: { id: parseInt(id) } })

  return Response.json({ success: true })
}
