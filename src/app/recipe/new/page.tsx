'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface IngredientMaster {
  id: number
  name: string
  unit: string
  pricePerUnit: number
}

interface SectionItem {
  type: 'section'
  key: string
  name: string
}

interface IngredientItem {
  type: 'ingredient'
  key: string
  name: string
  ingredientId?: number
  unit: string
  amount: string
  pricePerUnit?: number
  manualCost: string
  isNew: boolean
  newUnit: string
  newPricePerUnit: string
  showMasterForm: boolean
  suggestions: IngredientMaster[]
  showSuggestions: boolean
}

type ListItem = SectionItem | IngredientItem

function calcCost(row: IngredientItem): number | null {
  const amount = parseFloat(row.amount)
  if (isNaN(amount)) return null
  if (row.ingredientId && row.pricePerUnit != null) return amount * row.pricePerUnit
  if (!row.ingredientId) {
    const mc = parseFloat(row.manualCost)
    if (!isNaN(mc)) return mc
  }
  return null
}

// items配列を材料送信データに変換（セクション名を各材料に付与）
function itemsToSubmit(items: ListItem[]) {
  let currentSection: string | null = null
  return items.flatMap(item => {
    if (item.type === 'section') { currentSection = item.name.trim() || null; return [] }
    return [{ ...item, sectionName: currentSection }]
  })
}

export default function NewRecipePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [photoPath, setPhotoPath] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [steps, setSteps] = useState<string[]>([''])
  const [items, setItems] = useState<ListItem[]>([newIngRow()])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function newIngRow(): IngredientItem {
    return {
      type: 'ingredient',
      key: Math.random().toString(36).slice(2),
      name: '', ingredientId: undefined, unit: 'g', amount: '',
      pricePerUnit: undefined, manualCost: '', isNew: false,
      newUnit: 'g', newPricePerUnit: '', showMasterForm: false,
      suggestions: [], showSuggestions: false,
    }
  }

  function newSectionRow(): SectionItem {
    return { type: 'section', key: Math.random().toString(36).slice(2), name: '' }
  }

  const updIng = (key: string, patch: Partial<IngredientItem>) =>
    setItems(prev => prev.map(it => it.type === 'ingredient' && it.key === key ? { ...it, ...patch } : it))

  const searchIngredients = async (query: string, rowKey: string) => {
    if (!query) { updIng(rowKey, { suggestions: [], showSuggestions: false }); return }
    const res = await fetch(`/api/ingredients?q=${encodeURIComponent(query)}`)
    const data: IngredientMaster[] = await res.json()
    updIng(rowKey, { suggestions: data, showSuggestions: true })
  }

  const handleIngNameChange = (key: string, value: string) => {
    updIng(key, { name: value, ingredientId: undefined, pricePerUnit: undefined, isNew: false, showMasterForm: false })
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchIngredients(value, key), 200)
  }

  const handleSelectSuggestion = (key: string, ing: IngredientMaster) => {
    updIng(key, { name: ing.name, ingredientId: ing.id, unit: ing.unit, pricePerUnit: ing.pricePerUnit, isNew: false, showMasterForm: false, showSuggestions: false, suggestions: [] })
  }

  const handleIngBlur = async (key: string) => {
    setTimeout(async () => {
      const row = items.find(it => it.type === 'ingredient' && it.key === key) as IngredientItem | undefined
      if (!row || !row.name || row.ingredientId) { updIng(key, { showSuggestions: false }); return }
      const res = await fetch(`/api/ingredients?q=${encodeURIComponent(row.name)}`)
      const data: IngredientMaster[] = await res.json()
      const exact = data.find(d => d.name === row.name)
      if (exact) updIng(key, { ingredientId: exact.id, unit: exact.unit, pricePerUnit: exact.pricePerUnit, showSuggestions: false })
      else if (row.name) updIng(key, { isNew: true, showMasterForm: true, showSuggestions: false })
    }, 150)
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.path) {
        setError(`写真のアップロードに失敗しました: ${data.error ?? '不明なエラー'}`)
        setPhotoPreview('')
        return
      }
      setPhotoPath(data.path)
    } catch {
      setError('写真のアップロードに失敗しました。通信状況を確認してください。')
      setPhotoPreview('')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('レシピ名を入力してください'); return }

    const allIngItems = itemsToSubmit(items).filter(r => r.name.trim())

    const newIngs = allIngItems.filter(r => r.isNew && r.showMasterForm)
    for (const ni of newIngs) {
      if (!ni.newPricePerUnit) { setError(`「${ni.name}」の単価を入力してください`); return }
      const res = await fetch('/api/ingredients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ni.name, unit: ni.newUnit || ni.unit, pricePerUnit: parseFloat(ni.newPricePerUnit) }),
      })
      if (res.ok) {
        const created: IngredientMaster = await res.json()
        updIng(ni.key, { ingredientId: created.id, unit: created.unit, pricePerUnit: created.pricePerUnit })
        allIngItems.forEach(fi => { if (fi.key === ni.key) { fi.ingredientId = created.id; fi.unit = created.unit } })
      }
    }

    setSaving(true)
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          photoPath: photoPath || null,
          referenceUrl: referenceUrl.trim() || null,
          steps: steps.filter(s => s.trim()),
          ingredients: allIngItems.map(r => ({
            ingredientId: r.ingredientId ?? null,
            customName: !r.ingredientId ? r.name : null,
            amount: parseFloat(r.amount) || 0,
            unit: r.unit,
            manualCost: (!r.ingredientId && r.manualCost) ? parseFloat(r.manualCost) : null,
            sectionName: r.sectionName ?? null,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '保存に失敗しました')
        return
      }

      const recipe = await res.json()
      router.push(`/recipe/${recipe.id}`)
    } finally {
      setSaving(false)
    }
  }

  const totalCost = items.reduce((sum, it) => {
    if (it.type !== 'ingredient') return sum
    const c = calcCost(it)
    return c != null ? sum + c : sum
  }, 0)

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">新しいレシピを登録</h1>
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 基本情報 */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-4">基本情報</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">料理名 *</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="例: 唐揚げ"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">メモ・説明</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="料理の特徴やポイントなど"
                rows={2}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">参考URL</label>
              <input
                type="url" value={referenceUrl} onChange={e => setReferenceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">料理の写真</label>
              <input type="file" accept="image/*" onChange={handlePhotoChange}
                className="w-full text-sm text-stone-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
              {uploading && (
                <p className="mt-2 text-sm text-orange-500">📤 写真をアップロード中...</p>
              )}
              {photoPreview && !uploading && (
                <div className="mt-2 relative w-32 h-32 rounded-lg overflow-hidden">
                  <Image src={photoPreview} alt="プレビュー" fill className="object-cover" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 材料 */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-4">材料</h2>
          <div className="space-y-2">
            {items.map((item, i) => item.type === 'section' ? (
              /* セクションヘッダー */
              <div key={item.key} className="flex gap-2 items-center mt-3 first:mt-0">
                <span className="text-orange-400 text-base">📂</span>
                <input
                  type="text" value={item.name}
                  onChange={e => setItems(prev => prev.map(it => it.key === item.key ? { ...it, name: e.target.value } : it))}
                  placeholder="セクション名（例: タルト生地、スポンジ）"
                  className="flex-1 border-b-2 border-orange-300 bg-orange-50 rounded px-2 py-1 text-sm font-semibold text-orange-700 focus:outline-none focus:border-orange-500"
                />
                <button type="button" onClick={() => setItems(prev => prev.filter(it => it.key !== item.key))}
                  className="text-stone-300 hover:text-red-500 px-1 text-lg">×</button>
              </div>
            ) : (
              /* 材料行 */
              <div key={item.key} className="space-y-1 pl-4 border-l-2 border-stone-100">
                <div className="flex gap-2 items-start">
                  <div className="relative flex-1">
                    <input
                      type="text" value={item.name}
                      onChange={e => handleIngNameChange(item.key, e.target.value)}
                      onBlur={() => handleIngBlur(item.key)}
                      onFocus={() => item.name && searchIngredients(item.name, item.key)}
                      placeholder="食材名"
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${item.ingredientId ? 'border-green-400 bg-green-50' : item.isNew ? 'border-orange-300 bg-orange-50' : 'border-stone-300'}`}
                    />
                    {item.showSuggestions && item.suggestions.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                        {item.suggestions.map(s => (
                          <button key={s.id} type="button" onMouseDown={() => handleSelectSuggestion(item.key, s)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 flex justify-between">
                            <span>{s.name}</span>
                            <span className="text-stone-400 text-xs">¥{s.pricePerUnit}/{s.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setItems(prev => prev.filter(it => it.key !== item.key))}
                    className="text-stone-400 hover:text-red-500 px-1 py-2 text-lg">×</button>
                </div>
                <div className="flex gap-2 items-center">
                  <input type="number" value={item.amount}
                    onChange={e => updIng(item.key, { amount: e.target.value })}
                    placeholder="量" className="w-24 border border-stone-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    step="any" min="0" />
                  <span className="text-sm text-stone-500">{item.unit}</span>
                  <span className="flex-1 text-right text-sm font-medium text-orange-600">
                    {calcCost(item) != null ? `¥${Math.round(calcCost(item)!).toLocaleString()}` : ''}
                  </span>
                </div>
                {item.isNew && !item.ingredientId && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs text-orange-700 font-medium mb-2">「{item.name}」は新しい食材です。単価を入力するとマスタに登録されます。</p>
                    <div className="flex gap-2 flex-wrap">
                      <div>
                        <label className="text-xs text-stone-600">単位</label>
                        <select value={item.newUnit} onChange={e => updIng(item.key, { newUnit: e.target.value, unit: e.target.value })}
                          className="mt-0.5 block border border-stone-300 rounded px-2 py-1 text-xs">
                          {['g', 'ml', '個', '枚', '本', '袋', '缶', '大さじ', '小さじ', 'カップ'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-stone-600">単価 (¥/単位)</label>
                        <input type="number" value={item.newPricePerUnit} step="0.01" min="0"
                          onChange={e => updIng(item.key, { newPricePerUnit: e.target.value })}
                          placeholder="0.00" className="mt-0.5 block w-24 border border-stone-300 rounded px-2 py-1 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-stone-600">またはこの料理での金額(¥)</label>
                        <input type="number" value={item.manualCost} step="1" min="0"
                          onChange={e => updIng(item.key, { manualCost: e.target.value })}
                          placeholder="手動入力" className="mt-0.5 block w-24 border border-stone-300 rounded px-2 py-1 text-xs" />
                      </div>
                    </div>
                  </div>
                )}
                {item.ingredientId && (
                  <p className="text-xs text-green-600">✓ マスタから取得 (¥{item.pricePerUnit}/{item.unit})</p>
                )}
                {i === items.length - 1 && (
                  <div className="text-right text-sm font-bold text-stone-700 border-t border-stone-100 pt-2">
                    合計金額: ¥{Math.round(totalCost).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={() => setItems(prev => [...prev, newIngRow()])}
              className="text-orange-600 hover:text-orange-700 text-sm font-medium">
              + 材料を追加
            </button>
            <button type="button" onClick={() => setItems(prev => [...prev, newSectionRow()])}
              className="text-orange-400 hover:text-orange-600 text-sm font-medium">
              📂 セクションを追加
            </button>
          </div>
        </section>

        {/* 手順 */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-4">作り方</h2>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-sm font-bold text-orange-500 w-6 pt-2 shrink-0">{i + 1}</span>
                <textarea
                  value={step}
                  onChange={e => setSteps(prev => prev.map((s, j) => j === i ? e.target.value : s))}
                  placeholder={`手順${i + 1}`}
                  rows={2}
                  className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
                <button
                  type="button"
                  onClick={() => setSteps(prev => prev.filter((_, j) => j !== i))}
                  disabled={steps.length === 1}
                  className="text-stone-400 hover:text-red-500 px-1 py-2 text-lg disabled:opacity-30"
                >×</button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSteps(prev => [...prev, ''])}
            className="mt-3 text-orange-600 hover:text-orange-700 text-sm font-medium"
          >
            + 手順を追加
          </button>
        </section>

        {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit" disabled={saving || uploading}
            className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
          >
            {saving ? '保存中...' : uploading ? '写真アップロード中...' : 'レシピを保存'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-stone-100 text-stone-700 px-6 py-3 rounded-xl font-medium hover:bg-stone-200 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}
