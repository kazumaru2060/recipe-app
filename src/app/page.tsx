import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'

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

  const getLatestCost = (recipe: typeof recipes[0]) => {
    const latest = recipe.versions[0]
    if (!latest) return null
    let total = 0
    for (const ri of latest.ingredients) {
      if (ri.ingredient && ri.ingredientId) {
        const cost = ri.amount * ri.ingredient.pricePerUnit
        total += cost
      } else if (ri.manualCost != null) {
        total += ri.manualCost
      }
    }
    return total
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">料理一覧</h1>
        <Link
          href="/recipe/new"
          className="bg-orange-500 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          + 新しいレシピを登録
        </Link>
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="text-5xl mb-4">🍽️</p>
          <p className="text-lg font-medium">まだレシピが登録されていません</p>
          <p className="text-sm mt-1">「新しいレシピを登録」から追加してみましょう</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {recipes.map((recipe) => {
            const cost = getLatestCost(recipe)
            const versionCount = recipe.versions.length
            return (
              <Link key={recipe.id} href={`/recipe/${recipe.id}`}>
                <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                  <div className="aspect-square bg-stone-100 relative">
                    {recipe.photoPath ? (
                      <Image
                        src={recipe.photoPath}
                        alt={recipe.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-4xl text-stone-300">
                        🍳
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-stone-800 text-sm leading-tight line-clamp-2">
                      {recipe.name}
                    </p>
                    {cost != null && (
                      <p className="text-xs text-orange-600 mt-1 font-medium">
                        約 ¥{Math.round(cost).toLocaleString()}
                      </p>
                    )}
                    {versionCount > 1 && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        v{versionCount} まで改善済
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
