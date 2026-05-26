import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { name, unit, pricePerUnit, tbspGrams, tspGrams } = body

  const ingredient = await prisma.ingredient.update({
    where: { id: parseInt(id) },
    data: {
      name, unit, pricePerUnit: parseFloat(pricePerUnit),
      tbspGrams: tbspGrams != null ? parseFloat(tbspGrams) : null,
      tspGrams: tspGrams != null ? parseFloat(tspGrams) : null,
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
