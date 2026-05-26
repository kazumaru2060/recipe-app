import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { name, unit, pricePerUnit, tspGrams } = body

  const tsp = tspGrams != null ? parseFloat(tspGrams) : null
  const ingredient = await prisma.ingredient.update({
    where: { id: parseInt(id) },
    data: {
      name, unit, pricePerUnit: parseFloat(pricePerUnit),
      tspGrams: tsp,
      tbspGrams: tsp != null ? tsp * 3 : null,
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
