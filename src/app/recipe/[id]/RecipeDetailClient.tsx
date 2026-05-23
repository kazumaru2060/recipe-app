'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface IngredientMaster {
  id: number; name: string; unit: string; pricePerUnit: number
}
interface RecipeIngredient {
  id: number; ingredientId: number | null; customName: string | null
  amount: number; unit: string; manualCost: number | null
  ingredient: IngredientMaster | null
}
interface RecipeVersion {
  id: number; versionNumber: number; notes: string | null; steps: string; createdAt: string
  ingredients: RecipeIngredient[]
}
interface Recipe {
  id: number; name: string; description: string | null; photoPath: string | null
  referenceUrl: string | null; createdAt: string; versions: RecipeVersion[]
}

function calcVersionCost(version: RecipeVersion): number {
  return version.ingredients.reduce((sum, ri) => {
    if (ri.ingredient) return sum + ri.amount * ri.ingredient.pricePerUnit
    if (ri.manualCost != null) return sum + ri.manualCost
    return sum
  }, 0)
}

function getIngName(ri: RecipeIngredient) {
  return ri.ingredient?.name ?? ri.customName ?? '不明'
}

function diffIngredients(oldV: RecipeVersion, newV: RecipeVersion) {
  const oldMap = new Map(oldV.ingredients.map(i => [getIngName(i), i]))
  const newMap = new Map(newV.ingredients.map(i => [getIngName(i), i]))
  const changes: { name: string; type: 'added' | 'removed' | 'changed' | 'same'; oldAmount?: number; oldUnit?: string; newAmount?: number; newUnit?: string }[] = []
  const allNames = new Set([...oldMap.keys(), ...newMap.keys()])
  for (const name of allNames) {
    const o = oldMap.get(name)
    const n = newMap.get(name)
    if (!o) changes.push({ name, type: 'added', newAmount: n!.amount, newUnit: n!.unit })
    else if (!n) changes.push({ name, type: 'removed', oldAmount: o.amount, oldUnit: o.unit })
    else if (o.amount !== n.amount || o.unit !== n.unit)
      changes.push({ name, type: 'changed', oldAmount: o.amount, oldUnit: o.unit, newAmount: n.amount, newUnit: n.unit })
    else changes.push({ name, type: 'same', oldAmount: o.amount, oldUnit: o.unit })
  }
  return changes
}

export default function RecipeDetailClient({ recipe }: { recipe: Recipe }) {
  const router = useRouter()
  const [activeVersionIndex, setActiveVersionIndex] = useState(recipe.versions.length - 1)
  const [showHistory, setShowHistory] = useState(false)
  const [compareIndex, setCompareIndex] = useState<number | null>(null)

  const activeVersion = recipe.versions[activeVersionIndex]
  const steps: string[] = activeVersion ? JSON.parse(activeVersion.steps) : []
  const cost = activeVersion ? calcVersionCost(activeVersion) : 0

  const handleDelete = async () => {
    if (!confirm('このレシピを削除しますか？')) return
    await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' })
    router.push('/')
  }

  const compareVersion = compareIndex != null ? recipe.versions[compareIndex] : null
  const diffResult = compareVersion && activeVersion ? diffIngredients(compareVersion, activeVersion) : []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm text-stone-400 hover:text-stone-600 mb-1 inline-block">← 一覧へ戻る</Link>
          <h1 className="text-2xl font-bold text-stone-800">{recipe.name}</h1>
          {recipe.description && <p className="text-stone-500 mt-1 text-sm">{recipe.description}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href={`/recipe/${recipe.id}/improve`}
            className="bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            改善版を追加
          </Link>
          <button
            onClick={handleDelete}
            className="bg-stone-100 text-stone-500 px-3 py-1.5 rounded-full text-sm hover:bg-red-100 hover:text-red-600 transition-colors"
          >
            削除
          </button>
        </div>
      </div>

      {/* バージョン選択 */}
      {recipe.versions.length > 1 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-stone-700">バージョン</h2>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {showHistory ? '履歴を閉じる' : '改善履歴を見る'}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {recipe.versions.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setActiveVersionIndex(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${i === activeVersionIndex ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >
                v{v.versionNumber}
                {i === recipe.versions.length - 1 && <span className="ml-1 text-orange-200">（最新）</span>}
              </button>
            ))}
          </div>
          {activeVersion?.notes && (
            <p className="mt-2 text-xs text-stone-500 bg-stone-50 rounded px-3 py-2">
              📝 {activeVersion.notes}
            </p>
          )}

          {showHistory && (
            <div className="mt-3 border-t border-stone-100 pt-3 space-y-2">
              {recipe.versions.map((v, i) => (
                <div key={v.id} className="flex items-start gap-3 text-xs">
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${i === activeVersionIndex ? 'bg-orange-500' : 'bg-stone-300'}`} />
                  <div className="flex-1">
                    <span className="font-medium text-stone-700">v{v.versionNumber}</span>
                    <span className="text-stone-400 ml-2">{new Date(v.createdAt).toLocaleDateString('ja-JP')}</span>
                    {v.notes && <p className="text-stone-500 mt-0.5">{v.notes}</p>}
                    {i > 0 && (
                      <button
                        onClick={() => setCompareIndex(compareIndex === i - 1 ? null : i - 1)}
                        className="text-blue-500 hover:text-blue-700 mt-1"
                      >
                        {compareIndex === i - 1 ? '比較を閉じる' : `v${v.versionNumber - 1}と比較`}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 差分表示 */}
          {compareVersion && diffResult.length > 0 && (
            <div className="mt-3 border-t border-stone-100 pt-3">
              <p className="text-xs font-semibold text-stone-600 mb-2">
                v{compareVersion.versionNumber} → v{activeVersion.versionNumber} の変更点
              </p>
              <div className="space-y-1">
                {diffResult.filter(d => d.type !== 'same').map(d => (
                  <div key={d.name} className={`text-xs px-2 py-1 rounded ${d.type === 'added' ? 'bg-green-50 text-green-700' : d.type === 'removed' ? 'bg-red-50 text-red-600 line-through' : 'bg-yellow-50 text-yellow-700'}`}>
                    {d.type === 'added' && `+ ${d.name}: ${d.newAmount}${d.newUnit}`}
                    {d.type === 'removed' && `- ${d.name}: ${d.oldAmount}${d.oldUnit}`}
                    {d.type === 'changed' && `${d.name}: ${d.oldAmount}${d.oldUnit} → ${d.newAmount}${d.newUnit}`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 写真 */}
      {recipe.photoPath && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-sm">
          <Image src={recipe.photoPath} alt={recipe.name} fill className="object-cover" />
        </div>
      )}

      {/* 参考URL */}
      {recipe.referenceUrl && (
        <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm">
          <span className="text-stone-500">参考URL: </span>
          <a href={recipe.referenceUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline break-all">
            {recipe.referenceUrl}
          </a>
        </div>
      )}

      {/* 材料 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-stone-700">材料</h2>
          <span className="text-sm font-bold text-orange-600">
            合計: 約 ¥{Math.round(cost).toLocaleString()}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-stone-500 text-xs">
              <th className="text-left pb-2">食材</th>
              <th className="text-right pb-2">量</th>
              <th className="text-right pb-2">コスト</th>
            </tr>
          </thead>
          <tbody>
            {activeVersion?.ingredients.map(ri => {
              const c = ri.ingredient ? ri.amount * ri.ingredient.pricePerUnit : ri.manualCost
              return (
                <tr key={ri.id} className="border-b border-stone-50">
                  <td className="py-2 font-medium text-stone-800">
                    {getIngName(ri)}
                    {!ri.ingredient && <span className="ml-1 text-xs text-stone-400">(手動)</span>}
                  </td>
                  <td className="py-2 text-right text-stone-600">{ri.amount}{ri.unit}</td>
                  <td className="py-2 text-right text-orange-600">
                    {c != null ? `¥${Math.round(c).toLocaleString()}` : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 作り方 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
        <h2 className="text-base font-semibold text-stone-700 mb-4">作り方</h2>
        {steps.length === 0 ? (
          <p className="text-stone-400 text-sm">手順が登録されていません</p>
        ) : (
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-orange-500 font-bold text-sm w-6 shrink-0">{i + 1}</span>
                <p className="text-stone-700 text-sm leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="text-xs text-stone-400 text-center">
        登録日: {new Date(recipe.createdAt).toLocaleDateString('ja-JP')}
      </p>
    </div>
  )
}
