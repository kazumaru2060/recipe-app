'use client'

import { useState, useEffect, useRef, use } from 'react'
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
  id: number; versionNumber: number; notes: string | null; steps: string
  ingredients: RecipeIngredient[]
}
interface Recipe {
  id: number; name: string; versions: RecipeVersion[]
}

interface IngredientRow {
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
  suggestions: IngredientMaster[]
  showSuggestions: boolean
}

export default function ImprovePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [notes, setNotes] = useState('')
  const [steps, setSteps] = useState<string[]>([''])
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
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
          setIngredients(latest.ingredients.map(ri => ({
            key: Math.random().toString(36).slice(2),
            name: ri.ingredient?.name ?? ri.customName ?? '',
            ingredientId: ri.ingredientId ?? undefined,
            unit: ri.unit,
            amount: String(ri.amount),
            pricePerUnit: ri.ingredient?.pricePerUnit,
            manualCost: ri.manualCost != null ? String(ri.manualCost) : '',
            isNew: false,
            newUnit: 'g',
            newPricePerUnit: '',
            suggestions: [],
            showSuggestions: false,
          })))
        }
      })
  }, [id])

  const searchIngredients = async (query: string, rowKey: string) => {
    if (!query) {
      setIngredients(prev => prev.map(r => r.key === rowKey ? { ...r, suggestions: [], showSuggestions: false } : r))
      return
    }
    const res = await fetch(`/api/ingredients?q=${encodeURIComponent(query)}`)
    const data: IngredientMaster[] = await res.json()
    setIngredients(prev => prev.map(r =>
      r.key === rowKey ? { ...r, suggestions: data, showSuggestions: true } : r
    ))
  }

  const handleIngNameChange = (key: string, value: string) => {
    setIngredients(prev => prev.map(r =>
      r.key === key ? { ...r, name: value, ingredientId: undefined, pricePerUnit: undefined, isNew: false } : r
    ))
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchIngredients(value, key), 200)
  }

  const handleSelectSuggestion = (key: string, ing: IngredientMaster) => {
    setIngredients(prev => prev.map(r =>
      r.key === key
        ? { ...r, name: ing.name, ingredientId: ing.id, unit: ing.unit, pricePerUnit: ing.pricePerUnit, isNew: false, showSuggestions: false, suggestions: [] }
        : r
    ))
  }

  const handleIngBlur = (key: string) => {
    setTimeout(async () => {
      const row = ingredients.find(r => r.key === key)
      if (!row || !row.name || row.ingredientId) {
        setIngredients(prev => prev.map(r => r.key === key ? { ...r, showSuggestions: false } : r))
        return
      }
      const res = await fetch(`/api/ingredients?q=${encodeURIComponent(row.name)}`)
      const data: IngredientMaster[] = await res.json()
      const exact = data.find(d => d.name === row.name)
      if (exact) {
        setIngredients(prev => prev.map(r =>
          r.key === key ? { ...r, ingredientId: exact.id, unit: exact.unit, pricePerUnit: exact.pricePerUnit, showSuggestions: false } : r
        ))
      } else if (row.name) {
        setIngredients(prev => prev.map(r =>
          r.key === key ? { ...r, isNew: true, showSuggestions: false } : r
        ))
      }
    }, 150)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!notes.trim()) { setError('改善メモを入力してください（何を変えたか）'); return }

    const filledIngredients = ingredients.filter(r => r.name.trim())

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
          steps: steps.filter(s => s.trim()),
          ingredients: filledIngredients.map(r => ({
            ingredientId: r.ingredientId ?? null,
            customName: !r.ingredientId ? r.name : null,
            amount: parseFloat(r.amount) || 0,
            unit: r.unit,
            manualCost: (!r.ingredientId && r.manualCost) ? parseFloat(r.manualCost) : null,
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

  const newRow = (): IngredientRow => ({
    key: Math.random().toString(36).slice(2),
    name: '', ingredientId: undefined, unit: 'g', amount: '',
    pricePerUnit: undefined, manualCost: '', isNew: false,
    newUnit: 'g', newPricePerUnit: '', suggestions: [], showSuggestions: false,
  })

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

        {/* 材料（前バージョンからコピー済み） */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
          <h2 className="text-base font-semibold text-stone-700 mb-2">材料（前バージョンから編集できます）</h2>
          <p className="text-xs text-stone-400 mb-4">変更した箇所だけ修正してください</p>
          <div className="space-y-3">
            {ingredients.map((row) => (
              <div key={row.key} className="space-y-1">
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
                  <input
                    type="number" value={row.amount}
                    onChange={e => setIngredients(prev => prev.map(r => r.key === row.key ? { ...r, amount: e.target.value } : r))}
                    placeholder="量" className="w-20 border border-stone-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    step="any" min="0"
                  />
                  <div className="w-16 text-center py-2 text-sm text-stone-500">{row.unit}</div>
                  <button type="button"
                    onClick={() => setIngredients(prev => prev.filter(r => r.key !== row.key))}
                    className="text-stone-400 hover:text-red-500 px-1 py-2 text-lg"
                  >×</button>
                </div>
                {row.isNew && !row.ingredientId && (
                  <div className="ml-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs text-orange-700 font-medium mb-2">新しい食材です。単価を入力するとマスタに登録されます。</p>
                    <div className="flex gap-2 flex-wrap">
                      <div>
                        <label className="text-xs text-stone-600">単位</label>
                        <select value={row.newUnit}
                          onChange={e => setIngredients(prev => prev.map(r => r.key === row.key ? { ...r, newUnit: e.target.value, unit: e.target.value } : r))}
                          className="mt-0.5 block border border-stone-300 rounded px-2 py-1 text-xs">
                          {['g', 'ml', '個', '枚', '本', '袋', '缶'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-stone-600">単価(¥/単位)</label>
                        <input type="number" value={row.newPricePerUnit} step="0.01" min="0"
                          onChange={e => setIngredients(prev => prev.map(r => r.key === row.key ? { ...r, newPricePerUnit: e.target.value } : r))}
                          className="mt-0.5 block w-20 border border-stone-300 rounded px-2 py-1 text-xs" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setIngredients(prev => [...prev, newRow()])}
            className="mt-3 text-orange-600 hover:text-orange-700 text-sm font-medium">
            + 食材を追加
          </button>
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
          <button type="submit" disabled={saving}
            className="flex-1 bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 disabled:opacity-60 transition-colors">
            {saving ? '保存中...' : '改善版を保存'}
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
