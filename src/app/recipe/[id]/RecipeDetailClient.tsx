'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface IngredientMaster {
  id: number; name: string; unit: string; pricePerUnit: number
  tbspGrams: number | null; tspGrams: number | null
}
interface RecipeIngredient {
  id: number; ingredientId: number | null; customName: string | null
  amount: number; unit: string; manualCost: number | null; sectionName: string | null
  ingredient: IngredientMaster | null
}
interface RecipeVersion {
  id: number; versionNumber: number; notes: string | null; steps: string; createdAt: string
  photoPath: string | null
  ingredients: RecipeIngredient[]
}
interface Recipe {
  id: number; name: string; description: string | null; photoPath: string | null
  referenceUrl: string | null; createdAt: string; versions: RecipeVersion[]
}

function calcIngCost(ri: RecipeIngredient): number | null {
  if (ri.ingredient) {
    const ing = ri.ingredient
    if (ri.unit === ing.unit) return ri.amount * ing.pricePerUnit
    if (ing.unit === 'g' || ing.unit === 'ml') {
      if (ri.unit === '大さじ' && ing.tbspGrams != null) return ri.amount * ing.tbspGrams * ing.pricePerUnit
      if (ri.unit === '小さじ' && ing.tspGrams != null) return ri.amount * ing.tspGrams * ing.pricePerUnit
    }
    return null
  }
  return ri.manualCost ?? null
}

function calcVersionCost(version: RecipeVersion): number {
  return version.ingredients.reduce((sum, ri) => {
    const c = calcIngCost(ri)
    return c != null ? sum + c : sum
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

function generateShareText(
  recipe: Recipe,
  version: RecipeVersion,
  opts: { hashtags: boolean; cost: boolean }
): string {
  const lines: string[] = []
  lines.push(`【${recipe.name}】`)
  if (recipe.description) lines.push('', recipe.description)

  lines.push('', '▼材料')
  let prevSec: string | null | undefined = undefined
  for (const ri of version.ingredients) {
    const sec = ri.sectionName ?? null
    if (sec !== prevSec) {
      prevSec = sec
      if (sec) lines.push('', `《${sec}》`)
    }
    const name = ri.ingredient?.name ?? ri.customName ?? ''
    let line = `・${name}　${ri.amount}${ri.unit}`
    if (opts.cost) {
      const c = ri.ingredient ? ri.amount * ri.ingredient.pricePerUnit : ri.manualCost
      if (c != null) line += `（¥${Math.round(c).toLocaleString()}）`
    }
    lines.push(line)
  }

  const steps: string[] = JSON.parse(version.steps)
  if (steps.length > 0) {
    lines.push('', '▼作り方')
    steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`))
  }

  if (version.notes) lines.push('', `📝 ${version.notes}`)
  if (opts.hashtags) lines.push('', '#料理 #レシピ #手作り #cooking #homecooking')

  return lines.join('\n')
}

export default function RecipeDetailClient({ recipe }: { recipe: Recipe }) {
  const router = useRouter()
  const [activeVersionIndex, setActiveVersionIndex] = useState(recipe.versions.length - 1)
  const [showHistory, setShowHistory] = useState(false)
  const [compareIndex, setCompareIndex] = useState<number | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [shareHashtags, setShareHashtags] = useState(true)
  const [shareCost, setShareCost] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => { setCanShare(!!navigator.share) }, [])

  const activeVersion = recipe.versions[activeVersionIndex]
  const steps: string[] = activeVersion ? JSON.parse(activeVersion.steps) : []
  const cost = activeVersion ? calcVersionCost(activeVersion) : 0

  const handleDelete = async () => {
    if (!confirm('このレシピを削除しますか？')) return
    await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' })
    router.push('/')
  }

  const shareText = showShare
    ? generateShareText(recipe, activeVersion, { hashtags: shareHashtags, cost: shareCost })
    : ''

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: recipe.name, text: shareText })
    } catch { /* user cancelled */ }
  }

  const handleSetCoverPhoto = async (photoPath: string) => {
    await fetch(`/api/recipes/${recipe.id}/cover-photo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoPath }),
    })
    router.refresh()
  }

  const compareVersion = compareIndex != null ? recipe.versions[compareIndex] : null
  const diffResult = compareVersion && activeVersion ? diffIngredients(compareVersion, activeVersion) : []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div>
        <Link href="/" className="text-sm text-stone-400 hover:text-stone-600 mb-2 inline-block">← 一覧へ戻る</Link>
        <h1 className="text-2xl font-bold text-stone-800">{recipe.name}</h1>
        {recipe.description && <p className="text-stone-500 mt-1 text-sm">{recipe.description}</p>}
        <div className="flex gap-2 flex-wrap mt-3">
          <Link
            href={`/recipe/${recipe.id}/edit?versionId=${activeVersion?.id}`}
            className="bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-orange-200 transition-colors"
          >
            v{activeVersion?.versionNumber} 編集
          </Link>
          <Link
            href={`/recipe/${recipe.id}/improve`}
            className="bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            改善版を追加
          </Link>
          <button
            onClick={() => setShowShare(true)}
            className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-green-200 transition-colors"
          >
            📤 シェア
          </button>
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

      {/* 写真（カバー or アクティブバージョンの写真） */}
      {(activeVersion?.photoPath || recipe.photoPath) && (
        <div className="space-y-2">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-sm">
            <Image
              src={activeVersion?.photoPath || recipe.photoPath!}
              alt={recipe.name}
              fill
              className="object-cover"
            />
          </div>
          {/* バージョン固有の写真がある場合、ホーム設定ボタンを表示 */}
          {activeVersion?.photoPath && activeVersion.photoPath !== recipe.photoPath && (
            <button
              onClick={() => handleSetCoverPhoto(activeVersion.photoPath!)}
              className="w-full text-sm bg-orange-50 text-orange-700 border border-orange-200 rounded-lg py-2 hover:bg-orange-100 transition-colors"
            >
              🏠 この写真をホーム画面の表示写真に設定する
            </button>
          )}
          {activeVersion?.photoPath && activeVersion.photoPath === recipe.photoPath && (
            <p className="text-center text-xs text-orange-500">✓ この写真がホーム画面に表示されています</p>
          )}
          {!activeVersion?.photoPath && recipe.photoPath && (
            <p className="text-center text-xs text-stone-400">（このバージョンに写真はありません。カバー写真を表示中）</p>
          )}
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
            {(() => {
              const rows: React.ReactNode[] = []
              let prevSec: string | null | undefined = undefined
              activeVersion?.ingredients.forEach(ri => {
                const sec = ri.sectionName ?? null
                if (sec !== prevSec) {
                  prevSec = sec
                  if (sec) {
                    rows.push(
                      <tr key={`sec-${sec}`}>
                        <td colSpan={3} className="pt-3 pb-1">
                          <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">📂 {sec}</span>
                        </td>
                      </tr>
                    )
                  }
                }
                const c = calcIngCost(ri)
                rows.push(
                  <tr key={ri.id} className="border-b border-stone-50">
                    <td className={`py-2 font-medium text-stone-800${sec ? ' pl-3' : ''}`}>
                      {getIngName(ri)}
                      {!ri.ingredient && <span className="ml-1 text-xs text-stone-400">(手動)</span>}
                    </td>
                    <td className="py-2 text-right text-stone-600">{ri.amount}{ri.unit}</td>
                    <td className="py-2 text-right text-orange-600">
                      {c != null ? `¥${Math.round(c).toLocaleString()}` : '-'}
                    </td>
                  </tr>
                )
              })
              return rows
            })()}
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

      {/* シェアモーダル */}
      {showShare && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h2 className="text-base font-semibold text-stone-800">📤 シェア用テキスト</h2>
              <button onClick={() => setShowShare(false)} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">×</button>
            </div>

            {/* オプション */}
            <div className="flex gap-5 px-5 py-3 bg-stone-50 border-b border-stone-100">
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                <input type="checkbox" checked={shareHashtags} onChange={e => setShareHashtags(e.target.checked)} className="accent-orange-500" />
                ハッシュタグを含める
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                <input type="checkbox" checked={shareCost} onChange={e => setShareCost(e.target.checked)} className="accent-orange-500" />
                コストを含める
              </label>
            </div>

            {/* テキストプレビュー */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <textarea
                value={shareText}
                readOnly
                className="w-full h-64 border border-stone-200 rounded-xl p-3 text-sm text-stone-700 bg-stone-50 resize-none focus:outline-none leading-relaxed"
              />
              <p className="mt-2 text-xs text-stone-400">
                テキストをコピーして Instagram・X・LINE などに貼り付けてください
              </p>
            </div>

            {/* アクションボタン */}
            <div className="px-5 py-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={handleCopy}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
                  copied ? 'bg-green-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                {copied ? '✓ コピーしました！' : '📋 テキストをコピー'}
              </button>
              {canShare && (
                <button
                  onClick={handleNativeShare}
                  className="flex-1 bg-blue-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-600 transition-colors"
                >
                  📤 アプリで共有
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
