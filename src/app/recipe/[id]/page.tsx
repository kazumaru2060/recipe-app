import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import RecipeDetailClient from './RecipeDetailClient'

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const recipe = await prisma.recipe.findUnique({
    where: { id: parseInt(id) },
    include: {
      versions: {
        orderBy: { versionNumber: 'asc' },
        include: {
          ingredients: {
            include: { ingredient: true },
          },
        },
      },
    },
  })

  if (!recipe) notFound()

  const serialized = JSON.parse(JSON.stringify(recipe))

  return <RecipeDetailClient recipe={serialized} />
}
