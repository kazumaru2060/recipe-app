'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { compressImage } from '@/lib/compress-image'

interface IngredientMaster {
  id: number; name: string; unit: string; pricePerUnit: number
  tbspGrams: number | null; tspGrams: number | null
}

interface SectionItem { type: 'section'; key: string; name: string }
interface IngredientItem {
  type: 'ingredient'; key: string; name: string; ingredientId?: number
  masterUnit: string; unit: string; amount: string; pricePerUnit?: number
  tbspGrams: number | null; tspGrams: number | null
  manualCost: string; isNew: boolean; newUnit: string; newPricePerUnit: string
  showMasterForm: boolean; suggestions: IngredientMaster[]; showSuggestions: boolean
}
type ListItem = SectionItem | IngredientItem

const CONVERTIBLE_UNITS = ['g', 'ml']

function unitOptions(row: IngredientItem): string[] {
  if (!row.ingredientId) return ['g', 'ml', '個', '枚', '本', '袋', '缶', '大さじ', '小さじ', 'カップ']
  if (CONVERTIBLE_UNITS.includes(row.masterUnit)) return [row.masterUnit, '大さじ', '小さじ']
  return [row.masterUnit]
}

function calcCost(row: IngredientItem): number | null {
  const amount = parseFloat(row.amount)
  if (isNaN(amount)) return null
  if (row.ingredientId && row.pricePerUnit != null) {
    if (row.unit === row.masterUnit) return amount * row.pricePerUnit
    if (CONVERTIBLE_UNITS.includes(row.masterUnit)) {
      if (row.unit === '大さじ' && row.tbspGrams != null) return amount * row.tbspGrams * row.pricePerUnit
      if (row.unit === '小さじ' && row.tspGrams != null) return amount * row.tspGrams * row.pricePerUnit
    }
    return null
  }
  if (!row.ingredientId) { const mc = parseFloat(row.manualCost); if (!isNaN(mc)) return mc }
  return null
}

function newIngRow(): IngredientItem {
  return { type: 'ingredient', key: Math.random().toString(36).slice(2), name: '', ingredientId: undefined, masterUnit: 'g', unit: 'g', amount: '', pricePerUnit: undefined, tbspGrams: null, tspGrams: null, manualCost: '', isNew: false, newUnit: 'g', newPricePerUnit: '', showMasterForm: false, suggestions: [], showSuggestions: false }
}
function newSectionRow(name = ''): SectionItem {
  return { type: 'section', key: Math.random().toString(36).slice(2), name }
}
function itemsToSubmit(items: ListItem[]) {
  let sec: string | null = null
  return items.flatMap(it => { if (it.type === 'section') { sec = it.name.trim() || null; return [] } return [{ ...it, sectionName: sec }] })
}
function moveItemUp(items: ListItem[], key: string): ListItem[] {
  const idx = items.findIndex(it => it.key === key)
  if (idx <= 0) return items
  const next = [...items]
  ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
  return next
}
function moveItemDown(items: ListItem[], key: string): ListItem[] {
  const idx = items.findIndex(it => it.key === key)
  if (idx === -1 || idx >= items.length - 1) return items
  const next = [...items]
  ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
  return next
}
function insertIngredientAfter(items: ListItem[], key: string): ListItem[] {
  const idx = items.findIndex(it => it.key === key)
  const next = [...items]
  next.splice(idx === -1 ? next.length : idx + 1, 0, newIngRow())
  return next
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ingredientsToItems(ings: any[]): ListItem[] {
  const result: ListItem[] = []; let curSec: string | null | undefined = undefined
  for (const ri of ings) {
    const sec = ri.sectionName ?? null
    if (sec !== curSec) { if (sec) result.push(newSectionRow(sec)); curSec = sec }
    result.push({
      type: 'ingredient', key: Math.random().toString(36).slice(2),
      name: ri.ingredient?.name ?? ri.customName ?? '',
      ingredientId: ri.ingredientId ?? undefined,
      masterUnit: ri.ingredient?.unit ?? ri.unit,
      unit: ri.unit,
      amount: String(ri.amount), pricePerUnit: ri.ingredient?.pricePerUnit,
      tbspGrams: ri.ingredient?.tbspGrams ?? null,
      tspGrams: ri.ingredient?.tspGrams ?? null,
      manualCost: ri.manualCost != null ? String(ri.manualCost) : '',
      isNew: false, newUnit: ri.unit, newPricePerUnit: '', showMasterForm: false,
      suggestions: [], showSuggestions: false,
    })
  }
  return result.length > 0 ? result : [newIngRow()]
}

export default function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const versionId = searchParams.get('versionId')

  const [items, setItems] = useState<ListItem[]>([newIngRow()])
  const CATEGORIES = ['通常料理', 'スイーツ'] as const
  type Category = typeof CATEGORIES[number]
  const SERVINGS_UNITS = ['人分', '個', '枚', '本', '切れ', '台分'] as const

  const [loading, setLoading] = useState(true)
  const [editingVersionNumber, setEditingVersionNumber] = useState<number | null>(null)
  const [versionPhotoPath, setVersionPhotoPath] = useState('')
  const [versionPhotoPreview, setVersionPhotoPreview] = useState('')
  const [versionPhotoUploading, setVersionPhotoUploading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [category, setCategory] = useState<Category>('通常料理')
  const [servingsCount, setServingsCount] = useState('')
  const [servingsUnit, setServingsUnit] = useState<string>('人分')
  const [photoPath, setPhotoPath] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [steps, setSteps] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then(r => r.json())
      .then(recipe => {
        setName(recipe.name)
        setDescription(recipe.description ?? '')
        setCategory((recipe.category as Category) ?? '通常料理')
        setPhotoPath(recipe.photoPath ?? '')
        if (recipe.photoPath) setPhotoPreview(recipe.photoPath)
        const targetVersion = versionId
          ? recipe.versions.find((v: { id: number }) => v.id === parseInt(versionId))
          : recipe.versions[recipe.versions.length - 1]
        if (targetVersion) {
          setEditingVersionNumber(targetVersion.versionNumber)
          // バージョン固有の参考URLを優先、なければレシピ側にフォールバック
          setReferenceUrl(targetVersion.referenceUrl ?? recipe.referenceUrl ?? '')
          if (targetVersion.photoPath) { setVersionPhotoPath(targetVersion.photoPath); setVersionPhotoPreview(targetVersion.photoPath) }
          if (targetVersion.servings != null) { setServingsCount(String(targetVersion.servings)); setServingsUnit(targetVersion.servingsUnit ?? '人分') }
          const parsedSteps: string[] = JSON.parse(targetVersion.steps)
          setSteps(parsedSteps.length > 0 ? parsedSteps : [''])
          setItems(ingredientsToItems(targetVersion.ingredients))
        } else {
          setLoading(false); setError('指定されたバージョンが見つかりません'); return
        }
        setLoading(false)
      })
      .catch(() => { setError('レシピの読み込みに失敗しました'); setLoading(false) })
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
    updIng(key, { name: value, ingredientId: undefined, pricePerUnit: undefined, isNew: false, showMasterForm: false, tbspGrams: null, tspGrams: null })
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchIngredients(value, key), 200)
  }

  const handleSelectSuggestion = (key: string, ing: IngredientMaster) => {
    updIng(key, { name: ing.name, ingredientId: ing.id, masterUnit: ing.unit, unit: ing.unit, pricePerUnit: ing.pricePerUnit, tbspGrams: ing.tbspGrams, tspGrams: ing.tspGrams, isNew: false, showMasterForm: false, showSuggestions: false, suggestions: [] })
  }

  const handleIngBlur = async (key: string) => {
    setTimeout(async () => {
      const row = items.find(it => it.type === 'ingredient' && it.key === key) as IngredientItem | undefined
      if (!row || !row.name || row.ingredientId) { updIng(key, { showSuggestions: false }); return }
      const res = await fetch(`/api/ingredients?q=${encodeURIComponent(row.name)}`)
      const data: IngredientMaster[] = await res.json()
      const exact = data.find(d => d.name === row.name)
      if (exact) updIng(key, { ingredientId: exact.id, masterUnit: exact.unit, unit: exact.unit, pricePerUnit: exact.pricePerUnit, tbspGrams: exact.tbspGrams, tspGrams: exact.tspGrams, showSuggestions: false })
      else if (row.name) updIng(key, { isNew: true, showMasterForm: true, showSuggestions: false })
    }, 150)
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPhotoPreview(URL.createObjectURL(file)); setUploading(true); setError('')
    try {
      const compressed = await compressImage(file)
      const fd = new FormData(); fd.append('file', compressed)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.path) { setError(`写真のアップロードに失敗しました: ${data.error ?? '不明なエラー'}`); setPhotoPreview(photoPath); return }
      setPhotoPath(data.path)
    } catch { setError('写真のアップロードに失敗しました。'); setPhotoPreview(photoPath) }
    finally { setUploading(false) }
  }

  const handleVersionPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setVersionPhotoPreview(URL.createObjectURL(file)); setVersionPhotoUploading(true)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData(); fd.append('file', compressed)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.path) { setError(`写真のアップロードに失敗しました: ${data.error ?? '不明なエラー'}`); setVersionPhotoPreview(versionPhotoPath); return }
      setVersionPhotoPath(data.path)
    } catch { setError('写真のアップロードに失敗しました。'); setVersionPhotoPreview(versionPhotoPath) }
    finally { setVersionPhotoUploading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!name.trim()) { setError('レシピ名を入力してください'); return }

    const submitItems = itemsToSubmit(items)
    const filledIngredients = submitItems.filter(r => r.name.trim())

    const newIngs = filledIngredients.filter(r => r.isNew && r.showMasterForm)
    for (const ni of newIngs) {
      if (!ni.newPricePerUnit) { setError(`「${ni.name}」の単価を入力してください`); return }
      const res = await fetch('/api/ingredients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ni.name, unit: ni.newUnit || ni.unit, pricePerUnit: parseFloat(ni.newPricePerUnit) }),
      })
      if (res.ok) {
        const created: IngredientMaster = await res.json()
        updIng(ni.key, { ingredientId: created.id, masterUnit: created.unit, unit: created.unit, pricePerUnit: created.pricePerUnit })
        filledIngredients.forEach(fi => { if (fi.key === ni.key) { fi.ingredientId = created.id; fi.unit = created.unit } })
      }
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/recipes/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), description: description.trim() || null,
          photoPath: photoPath || null,
          category,
          servings: servingsCount ? parseInt(servingsCount) : null,
          servingsUnit: servingsCount ? servingsUnit : null,
          versionReferenceUrl: referenceUrl.trim() || null,
          versionId, versionPhotoPath: versionPhotoPath || null,
          steps: steps.filter(s => s.trim()),
          ingredients: filledIngredients.map(r => ({
            ingredientId: r.ingredientId ?? null,
            customName: !r.ingredientId ? r.name : null,
            amount: parseFloat(r.amount) || 0, unit: r.unit,
            manualCost: (!r.ingredientId && r.manualCost) ? parseFloat(r.manualCost) : null,
            sectionName: r.sectionName ?? null,
          })),
        }),
      })
      if (!res.ok) { const data = await res.json(); setError(data.error ?? '更新に失敗しました'); return }
      router.push(`/recipe/${id}`); router.refresh()
    } finally { setSaving(false) }
  }

  const totalCost = items
    .filter((it): it is IngredientItem => it.type === 'ingredient')
    .reduce((sum, r) => { const c = calcCost(r); return c != null ? sum + c : sum }, 0)

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-stone-400">読み込み中...</p></div>

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 mb-1">
        レシピを編集
        {editingVersionNumber != null && <span className="ml-2 text-lg font-normal text-orange-500">v{editingVersionNumber}</span>}
      </h1>
      <p className="text-sm text-stone-400 mb-6">このバージョンの内容を直接修正します（他のバージョンは変わりません）</p>
      <form onSubmit={handleSubmit} className="space-y-6">

        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-4">基本情報</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">料理名 *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例: 唐揚げ"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">カテゴリ</label>
              <div className="flex gap-2">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      category === c
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-stone-600 border-stone-300 hover:border-orange-400'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">何人分・何個分</label>
              <div className="flex gap-2 items-center">
                <input type="number" value={servingsCount} onChange={e => setServingsCount(e.target.value)}
                  placeholder="例: 4" min="1" step="1"
                  className="w-24 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <select value={servingsUnit} onChange={e => setServingsUnit(e.target.value)}
                  className="border border-stone-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {SERVINGS_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <span className="text-xs text-stone-400">（省略可）</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">メモ・説明</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">参考URL</label>
              <input type="url" value={referenceUrl} onChange={e => setReferenceUrl(e.target.value)} placeholder="https://..."
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">料理の写真</label>
              {photoPreview && !uploading && (
                <div className="mb-2 relative w-32 h-32 rounded-lg overflow-hidden">
                  <Image src={photoPreview} alt="現在の写真" fill className="object-cover" />
                </div>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoChange}
                className="w-full text-sm text-stone-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
              {uploading && <p className="mt-2 text-sm text-orange-500">📤 写真をアップロード中...</p>}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-1">このバージョンの写真（任意）</h2>
          <p className="text-xs text-stone-400 mb-3">このバージョン専用の写真です。詳細ページで「ホームに設定」ボタンで表示写真を選べます</p>
          {versionPhotoPreview && !versionPhotoUploading && (
            <div className="mb-2 relative w-32 h-32 rounded-lg overflow-hidden">
              <Image src={versionPhotoPreview} alt="バージョンの写真" fill className="object-cover" />
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleVersionPhotoChange}
            className="w-full text-sm text-stone-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          {versionPhotoUploading && <p className="mt-2 text-sm text-orange-500">📤 写真をアップロード中...</p>}
          {versionPhotoPath && (
            <button type="button" onClick={() => { setVersionPhotoPath(''); setVersionPhotoPreview('') }}
              className="mt-2 text-xs text-red-500 hover:text-red-700">× 写真を削除</button>
          )}
        </section>

        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-4">材料</h2>
          <div className="space-y-3">
            {items.map((item, idx) => {
              if (item.type === 'section') {
                return (
                  <div key={item.key} className="flex gap-2 items-center pt-2">
                    <span className="text-orange-400 text-sm">📂</span>
                    <input type="text" value={item.name}
                      onChange={e => setItems(prev => prev.map(it => it.key === item.key ? { ...it, name: e.target.value } : it))}
                      placeholder="セクション名（例: タルト生地）"
                      className="flex-1 border-0 border-b-2 border-orange-300 bg-transparent px-1 py-1 text-sm font-semibold text-orange-700 focus:outline-none focus:border-orange-500" />
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => setItems(prev => moveItemUp(prev, item.key))} disabled={idx === 0}
                        title="上に移動" className="text-stone-300 hover:text-orange-500 disabled:opacity-20 px-1 text-sm">▲</button>
                      <button type="button" onClick={() => setItems(prev => moveItemDown(prev, item.key))} disabled={idx === items.length - 1}
                        title="下に移動" className="text-stone-300 hover:text-orange-500 disabled:opacity-20 px-1 text-sm">▼</button>
                      <button type="button" onClick={() => setItems(prev => insertIngredientAfter(prev, item.key))}
                        title="この下に材料を追加" className="text-stone-300 hover:text-green-600 px-1 text-base">＋</button>
                      <button type="button" onClick={() => setItems(prev => prev.filter(it => it.key !== item.key))}
                        className="text-stone-300 hover:text-red-400 px-1 text-lg">×</button>
                    </div>
                  </div>
                )
              }
              const row = item
              return (
                <div key={row.key} className="space-y-2 pl-4 border-l-2 border-stone-100">
                  <div className="flex gap-2 items-start">
                    <div className="relative flex-1">
                      <input type="text" value={row.name}
                        onChange={e => handleIngNameChange(row.key, e.target.value)}
                        onBlur={() => handleIngBlur(row.key)}
                        onFocus={() => row.name && searchIngredients(row.name, row.key)}
                        placeholder="食材名"
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${row.ingredientId ? 'border-green-400 bg-green-50' : row.isNew ? 'border-orange-300 bg-orange-50' : 'border-stone-300'}`} />
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
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => setItems(prev => moveItemUp(prev, row.key))} disabled={idx === 0}
                        title="上に移動" className="text-stone-400 hover:text-orange-500 disabled:opacity-20 px-1 py-2 text-sm">▲</button>
                      <button type="button" onClick={() => setItems(prev => moveItemDown(prev, row.key))} disabled={idx === items.length - 1}
                        title="下に移動" className="text-stone-400 hover:text-orange-500 disabled:opacity-20 px-1 py-2 text-sm">▼</button>
                      <button type="button" onClick={() => setItems(prev => insertIngredientAfter(prev, row.key))}
                        title="この下に材料を追加" className="text-stone-400 hover:text-green-600 px-1 py-2 text-base">＋</button>
                      <button type="button" onClick={() => setItems(prev => prev.filter(it => it.key !== row.key))}
                        className="text-stone-400 hover:text-red-500 px-1 py-2 text-lg">×</button>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="number" value={row.amount} onChange={e => updIng(row.key, { amount: e.target.value })}
                      placeholder="量" className="w-24 border border-stone-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      step="any" min="0" />
                    {unitOptions(row).length > 1 ? (
                      <select value={row.unit} onChange={e => updIng(row.key, { unit: e.target.value })}
                        className="border border-stone-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                        {unitOptions(row).map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : (
                      <span className="text-sm text-stone-500">{row.unit}</span>
                    )}
                    <span className="flex-1 text-right text-sm font-medium text-orange-600">
                      {calcCost(row) != null ? `¥${Math.round(calcCost(row)!).toLocaleString()}` : ''}
                    </span>
                  </div>
                  {row.ingredientId && CONVERTIBLE_UNITS.includes(row.masterUnit) &&
                    ((row.unit === '大さじ' && row.tbspGrams == null) ||
                     (row.unit === '小さじ' && row.tspGrams == null)) && (
                    <p className="text-xs text-amber-600 ml-1">⚠ 食材マスタに換算データが未登録のためコスト計算できません</p>
                  )}
                  {row.ingredientId && (
                    <p className="text-xs text-green-600 ml-2">
                      ✓ マスタから取得 (¥{row.pricePerUnit}/{row.masterUnit}
                      {row.tbspGrams != null && `、大さじ1=${row.tbspGrams}${row.masterUnit}`}
                      {row.tspGrams != null && `、小さじ1=${row.tspGrams}${row.masterUnit}`})
                    </p>
                  )}
                  {row.isNew && !row.ingredientId && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs text-orange-700 font-medium mb-2">「{row.name}」は新しい食材です。単価を入力するとマスタに登録されます。</p>
                      <div className="flex gap-2 flex-wrap">
                        <div>
                          <label className="text-xs text-stone-600">単位</label>
                          <select value={row.newUnit} onChange={e => updIng(row.key, { newUnit: e.target.value, unit: e.target.value })}
                            className="mt-0.5 block border border-stone-300 rounded px-2 py-1 text-xs">
                            {['g', 'ml', '個', '枚', '本', '袋', '缶', '大さじ', '小さじ', 'カップ'].map(u => <option key={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-stone-600">単価 (¥/単位)</label>
                          <input type="number" value={row.newPricePerUnit} step="0.01" min="0"
                            onChange={e => updIng(row.key, { newPricePerUnit: e.target.value })}
                            placeholder="0.00" className="mt-0.5 block w-24 border border-stone-300 rounded px-2 py-1 text-xs" />
                        </div>
                        <div>
                          <label className="text-xs text-stone-600">またはこの料理での金額(¥)</label>
                          <input type="number" value={row.manualCost} step="1" min="0"
                            onChange={e => updIng(row.key, { manualCost: e.target.value })}
                            placeholder="手動入力" className="mt-0.5 block w-24 border border-stone-300 rounded px-2 py-1 text-xs" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex gap-3 items-center">
            <button type="button" onClick={() => setItems(prev => [...prev, newIngRow()])}
              className="text-orange-600 hover:text-orange-700 text-sm font-medium">+ 材料を追加</button>
            <button type="button" onClick={() => setItems(prev => [...prev, newSectionRow()])}
              className="text-orange-400 hover:text-orange-600 text-sm font-medium">📂 セクションを追加</button>
            <span className="ml-auto text-sm font-bold text-stone-700">合計: ¥{Math.round(totalCost).toLocaleString()}</span>
          </div>
        </section>

        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-4">作り方</h2>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-sm font-bold text-orange-500 w-6 pt-2 shrink-0">{i + 1}</span>
                <textarea value={step} onChange={e => setSteps(prev => prev.map((s, j) => j === i ? e.target.value : s))}
                  placeholder={`手順${i + 1}`} rows={2}
                  className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
                <button type="button" onClick={() => setSteps(prev => prev.filter((_, j) => j !== i))}
                  disabled={steps.length === 1} className="text-stone-400 hover:text-red-500 px-1 py-2 text-lg disabled:opacity-30">×</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSteps(prev => [...prev, ''])}
            className="mt-3 text-orange-600 hover:text-orange-700 text-sm font-medium">+ 手順を追加</button>
        </section>

        {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving || uploading}
            className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors">
            {saving ? '更新中...' : uploading ? '写真アップロード中...' : '✏️ レシピを更新'}
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
