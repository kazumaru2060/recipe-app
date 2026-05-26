import { prisma } from '@/lib/prisma'
import HomeClient from './HomeClient'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const recipes = await prisma.recipe.findMany({
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        include: {
          ingredients: {
            include: { ingredient: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return <HomeClient recipes={recipes} />
}
