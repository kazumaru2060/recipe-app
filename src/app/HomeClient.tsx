'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Ingredient {
  id: number; name: string; unit: string; pricePerUnit: number
  tbspGrams: number | null; tspGrams: number | null
}
interface RecipeIngredient {
  id: number; ingredientId: number | null; amount: number; unit: string
  manualCost: number | null; customName: string | null; ingredient: Ingredient | null
}
interface RecipeVersion {
  id: number; versionNumber: number
  ingredients: RecipeIngredient[]
}
interface Recipe {
  id: number; name: string; description: string | null
  photoPath: string | null; category: string; versions: RecipeVersion[]
}

const CATEGORIES = ['すべて', '通常料理', 'スイーツ'] as const
type CategoryTab = typeof CATEGORIES[number]

function getLatestCost(recipe: Recipe): number | null {
  const latest = recipe.versions[0]
  if (!latest) return null
  let total = 0
  for (const ri of latest.ingredients) {
    if (ri.ingredient) {
      const ing = ri.ingredient
      if (ri.unit === ing.unit) {
        total += ri.amount * ing.pricePerUnit
      } else if (ing.unit === 'g' || ing.unit === 'ml') {
        if (ri.unit === '大さじ' && ing.tbspGrams != null) total += ri.amount * ing.tbspGrams * ing.pricePerUnit
        else if (ri.unit === '小さじ' && ing.tspGrams != null) total += ri.amount * ing.tspGrams * ing.pricePerUnit
      }
    } else if (ri.manualCost != null) {
      total += ri.manualCost
    }
  }
  return total
}

function recipeMatchesQuery(recipe: Recipe, q: string): boolean {
  const lower = q.toLowerCase()
  if (recipe.name.toLowerCase().includes(lower)) return true
  if ((recipe.description ?? '').toLowerCase().includes(lower)) return true
  const latest = recipe.versions[0]
  if (latest) {
    for (const ri of latest.ingredients) {
      const ingName = ri.ingredient?.name ?? ri.customName ?? ''
      if (ingName.toLowerCase().includes(lower)) return true
    }
  }
  return false
}

export default function HomeClient({ recipes }: { recipes: Recipe[] }) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('すべて')

  const trimmedQuery = query.trim()

  const filtered = recipes.filter(r => {
    const categoryMatch = activeCategory === 'すべて' || r.category === activeCategory
    const queryMatch = !trimmedQuery || recipeMatchesQuery(r, trimmedQuery)
    return categoryMatch && queryMatch
  })

  const counts: Record<CategoryTab, number> = {
    すべて: recipes.length,
    通常料理: recipes.filter(r => r.category === '通常料理').length,
    スイーツ: recipes.filter(r => r.category === 'スイーツ').length,
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-stone-800">料理一覧</h1>
        <Link
          href="/recipe/new"
          className="bg-orange-500 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors shrink-0"
        >
          + 新しいレシピを登録
        </Link>
      </div>

      {recipes.length > 0 && (
        <>
          {/* カテゴリタブ */}
          <div className="flex gap-2 mb-4">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cat}
                <span className={`ml-1.5 text-xs ${activeCategory === cat ? 'text-orange-100' : 'text-stone-400'}`}>
                  {counts[cat]}
                </span>
              </button>
            ))}
          </div>

          {/* 検索バー */}
          <div className="relative mb-5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-base pointer-events-none">🔍</span>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="料理名・食材名で検索..."
              className="w-full pl-9 pr-10 py-2.5 border border-stone-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        </>
      )}

      {/* 件数表示 */}
      {trimmedQuery && (
        <p className="text-sm text-stone-500 mb-4">
          「{query}」の検索結果：{filtered.length}件
        </p>
      )}

      {/* 一覧グリッド */}
      {recipes.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="text-5xl mb-4">🍽️</p>
          <p className="text-lg font-medium">まだレシピが登録されていません</p>
          <p className="text-sm mt-1">「新しいレシピを登録」から追加してみましょう</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-base">
            {trimmedQuery
              ? `「${query}」に一致するレシピは見つかりませんでした`
              : `${activeCategory}のレシピはまだありません`}
          </p>
          <div className="flex gap-3 justify-center mt-3">
            {trimmedQuery && (
              <button onClick={() => setQuery('')} className="text-sm text-orange-500 hover:text-orange-700">
                検索をクリア
              </button>
            )}
            {activeCategory !== 'すべて' && (
              <button onClick={() => setActiveCategory('すべて')} className="text-sm text-orange-500 hover:text-orange-700">
                すべてを表示
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((recipe) => {
            const cost = getLatestCost(recipe)
            const versionCount = recipe.versions.length
            return (
              <Link key={recipe.id} href={`/recipe/${recipe.id}`}>
                <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                  <div className="aspect-square bg-stone-100 relative">
                    {recipe.photoPath ? (
                      <Image src={recipe.photoPath} alt={recipe.name} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-4xl text-stone-300">
                        {recipe.category === 'スイーツ' ? '🍰' : '🍳'}
                      </div>
                    )}
                    {recipe.category === 'スイーツ' && (
                      <span className="absolute top-1.5 left-1.5 bg-pink-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full leading-none py-1">
                        🍰 スイーツ
                      </span>
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
                      <p className="text-xs text-stone-400 mt-0.5">v{versionCount} まで改善済</p>
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
