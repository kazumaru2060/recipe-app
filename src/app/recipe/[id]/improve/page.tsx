'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface IngredientMaster {
  id: number; name: string; unit: string; pricePerUnit: number
}

interface SectionItem { type: 'section'; key: string; name: string }
interface IngredientItem {
  type: 'ingredient'; key: string; name: string; ingredientId?: number
  unit: string; amount: string; pricePerUnit?: number; manualCost: string
  isNew: boolean; newUnit: string; newPricePerUnit: string; showMasterForm: boolean
  suggestions: IngredientMaster[]; showSuggestions: boolean
}
type ListItem = SectionItem | IngredientItem

interface RecipeVersion {
  id: number; versionNumber: number; notes: string | null; steps: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ingredients: any[]
}
interface Recipe {
  id: number; name: string; versions: RecipeVersion[]
}

function newIngRow(): IngredientItem {
  return { type: 'ingredient', key: Math.random().toString(36).slice(2), name: '', ingredientId: undefined, unit: 'g', amount: '', pricePerUnit: undefined, manualCost: '', isNew: false, newUnit: 'g', newPricePerUnit: '', showMasterForm: false, suggestions: [], showSuggestions: false }
}
function newSectionRow(name = ''): SectionItem {
  return { type: 'section', key: Math.random().toString(36).slice(2), name }
}
function itemsToSubmit(items: ListItem[]) {
  let sec: string | null = null
  return items.flatMap(it => { if (it.type === 'section') { sec = it.name.trim() || null; return [] } return [{ ...it, sectionName: sec }] })
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ingredientsToItems(ings: any[]): ListItem[] {
  const result: ListItem[] = []; let curSec: string | null | undefined = undefined
  for (const ri of ings) {
    const sec = ri.sectionName ?? null
    if (sec !== curSec) { if (sec) result.push(newSectionRow(sec)); curSec = sec }
    result.push({ type: 'ingredient', key: Math.random().toString(36).slice(2), name: ri.ingredient?.name ?? ri.customName ?? '', ingredientId: ri.ingredientId ?? undefined, unit: ri.unit, amount: String(ri.amount), pricePerUnit: ri.ingredient?.pricePerUnit, manualCost: ri.manualCost != null ? String(ri.manualCost) : '', isNew: false, newUnit: ri.unit, newPricePerUnit: '', showMasterForm: false, suggestions: [], showSuggestions: false })
  }
  return result.length > 0 ? result : [newIngRow()]
}

export default function ImprovePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [notes, setNotes] = useState('')
  const [steps, setSteps] = useState<string[]>([''])
  const [items, setItems] = useState<ListItem[]>([newIngRow()])
  const [photoPath, setPhotoPath] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then(r => r.json())
      .then((data: Recipe) => {
        setRecipe(data)
        const latest = data.versions[data.versions.length - 1]
        if (latest) {
          const existingSteps: string[] = JSON.parse(latest.steps)
          setSteps(existingSteps.length > 0 ? existingSteps : [''])
          setItems(ingredientsToItems(latest.ingredients))
        }
      })
  }, [id])

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

  const handleIngBlur = (key: string) => {
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
      setError('写真のアップロードに失敗しました。')
      setPhotoPreview('')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!notes.trim()) { setError('改善メモを入力してください（何を変えたか）'); return }

    const submitItems = itemsToSubmit(items)
    const filledIngredients = submitItems.filter(r => r.name.trim())

    const newIngs = filledIngredients.filter(r => r.isNew && !r.ingredientId)
    for (const ni of newIngs) {
      if (ni.newPricePerUnit) {
        const res = await fetch('/api/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: ni.name, unit: ni.newUnit || ni.unit, pricePerUnit: parseFloat(ni.newPricePerUnit) }),
        })
        if (res.ok) {
          const created: IngredientMaster = await res.json()
          updIng(ni.key, { ingredientId: created.id, unit: created.unit, pricePerUnit: created.pricePerUnit })
          filledIngredients.forEach(fi => {
            if (fi.key === ni.key) { fi.ingredientId = created.id; fi.unit = created.unit; fi.pricePerUnit = created.pricePerUnit }
          })
        }
      }
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/recipes/${id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes.trim(),
          photoPath: photoPath || null,
          steps: steps.filter(s => s.trim()),
          ingredients: filledIngredients.map(r => ({
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

      router.push(`/recipe/${id}`)
    } finally {
      setSaving(false)
    }
  }

  if (!recipe) return <div className="text-center py-20 text-stone-400">読み込み中...</div>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="text-sm text-stone-400 mb-1">← <a onClick={() => router.back()} className="cursor-pointer hover:text-stone-600">戻る</a></div>
        <h1 className="text-2xl font-bold text-stone-800">改善版を追加</h1>
        <p className="text-stone-500 text-sm mt-1">{recipe.name} (現在 v{recipe.versions.length})</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 改善メモ */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-3">改善メモ *</h2>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="例: 薄力粉を100g→110gに増やした。食感がもちもちになった。"
            rows={3}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
        </section>

        {/* このバージョンの写真（任意） */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-1">このバージョンの写真（任意）</h2>
          <p className="text-xs text-stone-400 mb-3">前のバージョンと異なる見た目になった場合など、任意で追加できます</p>
          <input type="file" accept="image/*" onChange={handlePhotoChange}
            className="w-full text-sm text-stone-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
          />
          {uploading && <p className="mt-2 text-sm text-orange-500">📤 写真をアップロード中...</p>}
          {photoPreview && !uploading && (
            <div className="mt-2 relative w-32 h-32 rounded-lg overflow-hidden">
              <Image src={photoPreview} alt="プレビュー" fill className="object-cover" />
            </div>
          )}
        </section>

        {/* 材料 */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-2">材料（前バージョンから編集できます）</h2>
          <p className="text-xs text-stone-400 mb-4">変更した箇所だけ修正してください</p>
          <div className="space-y-3">
            {items.map((item) => {
              if (item.type === 'section') {
                return (
                  <div key={item.key} className="flex gap-2 items-center pt-2">
                    <span className="text-orange-400 text-sm">📂</span>
                    <input
                      type="text" value={item.name}
                      onChange={e => setItems(prev => prev.map(it => it.key === item.key ? { ...it, name: e.target.value } : it))}
                      placeholder="セクション名（例: タルト生地）"
                      className="flex-1 border-0 border-b-2 border-orange-300 bg-transparent px-1 py-1 text-sm font-semibold text-orange-700 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => setItems(prev => prev.filter(it => it.key !== item.key))}
                      className="text-stone-300 hover:text-red-400 px-1 text-lg"
                    >×</button>
                  </div>
                )
              }
              const row = item
              return (
                <div key={row.key} className="space-y-2 pl-4 border-l-2 border-stone-100">
                  <div className="flex gap-2 items-start">
                    <div className="relative flex-1">
                      <input
                        type="text" value={row.name}
                        onChange={e => handleIngNameChange(row.key, e.target.value)}
                        onBlur={() => handleIngBlur(row.key)}
                        onFocus={() => row.name && searchIngredients(row.name, row.key)}
                        placeholder="食材名"
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${row.ingredientId ? 'border-green-400 bg-green-50' : row.isNew ? 'border-orange-300 bg-orange-50' : 'border-stone-300'}`}
                      />
                      {row.showSuggestions && row.suggestions.length > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {row.suggestions.map(s => (
                            <button key={s.id} type="button" onMouseDown={() => handleSelectSuggestion(row.key, s)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 flex justify-between">
                              <span>{s.name}</span>
                              <span className="text-stone-400 text-xs">¥{s.pricePerUnit}/{s.unit}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button"
                      onClick={() => setItems(prev => prev.filter(it => it.key !== row.key))}
                      className="text-stone-400 hover:text-red-500 px-1 py-2 text-lg"
                    >×</button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number" value={row.amount}
                      onChange={e => updIng(row.key, { amount: e.target.value })}
                      placeholder="量"
                      className="w-24 border border-stone-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      step="any" min="0"
                    />
                    <span className="text-sm text-stone-500">{row.unit}</span>
                  </div>
                  {row.isNew && !row.ingredientId && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs text-orange-700 font-medium mb-2">新しい食材です。単価を入力するとマスタに登録されます。</p>
                      <div className="flex gap-2 flex-wrap">
                        <div>
                          <label className="text-xs text-stone-600">単位</label>
                          <select value={row.newUnit}
                            onChange={e => updIng(row.key, { newUnit: e.target.value, unit: e.target.value })}
                            className="mt-0.5 block border border-stone-300 rounded px-2 py-1 text-xs">
                            {['g', 'ml', '個', '枚', '本', '袋', '缶', '大さじ', '小さじ', 'カップ'].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-stone-600">単価(¥/単位)</label>
                          <input type="number" value={row.newPricePerUnit} step="0.01" min="0"
                            onChange={e => updIng(row.key, { newPricePerUnit: e.target.value })}
                            className="mt-0.5 block w-24 border border-stone-300 rounded px-2 py-1 text-xs" />
                        </div>
                      </div>
                    </div>
                  )}
                  {row.ingredientId && (
                    <p className="text-xs text-green-600 ml-2">✓ マスタから取得 (¥{row.pricePerUnit}/{row.unit})</p>
                  )}
                </div>
              )
            })}
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
                  rows={2}
                  className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
                <button type="button"
                  onClick={() => setSteps(prev => prev.filter((_, j) => j !== i))}
                  disabled={steps.length === 1}
                  className="text-stone-400 hover:text-red-500 px-1 py-2 text-lg disabled:opacity-30">×</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSteps(prev => [...prev, ''])}
            className="mt-3 text-orange-600 hover:text-orange-700 text-sm font-medium">
            + 手順を追加
          </button>
        </section>

        {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving || uploading}
            className="flex-1 bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 disabled:opacity-60 transition-colors">
            {saving ? '保存中...' : uploading ? '写真アップロード中...' : '改善版を保存'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="bg-stone-100 text-stone-700 px-6 py-3 rounded-xl font-medium hover:bg-stone-200 transition-colors">
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}
