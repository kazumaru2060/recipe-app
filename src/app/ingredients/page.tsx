'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Ingredient {
  id: number
  name: string
  unit: string
  pricePerUnit: number
  tbspGrams: number | null
  tspGrams: number | null
  gramsPerUnit: number | null
  kcal: number | null; protein: number | null; fat: number | null
  carbs: number | null; fiber: number | null; calcium: number | null
  iron: number | null; vitA: number | null; vitB1: number | null
  vitB2: number | null; vitC: number | null; vitD: number | null
  vitE: number | null; salt: number | null
}

interface FoodEntry {
  name: string
  kcal: number; protein: number; fat: number; carbs: number; fiber: number
  calcium: number; iron: number; vitA: number; vitB1: number; vitB2: number
  vitC: number; vitD: number; vitE: number; salt: number
}

const WEIGHT_UNITS = ['g', 'ml']
const ALL_UNITS = ['g', 'ml', '個', '枚', '本', '袋', '缶', '大さじ', '小さじ', 'カップ']

type NutritionKey = keyof NutritionForm
const NUTRITION_FIELDS: { key: NutritionKey; label: string; unit: string }[] = [
  { key: 'kcal',    label: 'エネルギー',       unit: 'kcal' },
  { key: 'protein', label: 'たんぱく質',        unit: 'g' },
  { key: 'fat',     label: '脂質',              unit: 'g' },
  { key: 'carbs',   label: '炭水化物',          unit: 'g' },
  { key: 'fiber',   label: '食物繊維',          unit: 'g' },
  { key: 'calcium', label: 'カルシウム',        unit: 'mg' },
  { key: 'iron',    label: '鉄',               unit: 'mg' },
  { key: 'vitA',    label: 'ビタミンA',         unit: 'μg' },
  { key: 'vitB1',   label: 'ビタミンB1',        unit: 'mg' },
  { key: 'vitB2',   label: 'ビタミンB2',        unit: 'mg' },
  { key: 'vitC',    label: 'ビタミンC',         unit: 'mg' },
  { key: 'vitD',    label: 'ビタミンD',         unit: 'μg' },
  { key: 'vitE',    label: 'ビタミンE',         unit: 'mg' },
  { key: 'salt',    label: '食塩相当量',        unit: 'g' },
]

type NutritionForm = { [K in keyof FoodEntry as K extends 'name' ? never : K]: string }

const emptyNutrition = (): NutritionForm => ({
  kcal: '', protein: '', fat: '', carbs: '', fiber: '',
  calcium: '', iron: '', vitA: '', vitB1: '', vitB2: '',
  vitC: '', vitD: '', vitE: '', salt: '',
})

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', unit: 'g', pricePerUnit: '', tspGrams: '', gramsPerUnit: '' })
  const [nutrition, setNutrition] = useState<NutritionForm>(emptyNutrition())
  const [showNutrition, setShowNutrition] = useState(false)
  const [error, setError] = useState('')

  // 栄養素オートフィル
  const [nutQuery, setNutQuery] = useState('')
  const [nutSuggestions, setNutSuggestions] = useState<FoodEntry[]>([])
  const [showNutSuggestions, setShowNutSuggestions] = useState(false)
  const nutRef = useRef<HTMLDivElement>(null)

  const fetchIngredients = useCallback(async () => {
    const res = await fetch('/api/ingredients')
    const data = await res.json()
    setIngredients(data)
  }, [])

  useEffect(() => { fetchIngredients() }, [fetchIngredients])

  // 栄養素検索
  useEffect(() => {
    if (!nutQuery.trim()) { setNutSuggestions([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/food-composition?q=${encodeURIComponent(nutQuery)}`)
      const data = await res.json()
      setNutSuggestions(data)
      setShowNutSuggestions(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [nutQuery])

  // クリック外で候補を閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nutRef.current && !nutRef.current.contains(e.target as Node)) {
        setShowNutSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const applyFoodEntry = (entry: FoodEntry) => {
    setNutrition({
      kcal: String(entry.kcal), protein: String(entry.protein), fat: String(entry.fat),
      carbs: String(entry.carbs), fiber: String(entry.fiber), calcium: String(entry.calcium),
      iron: String(entry.iron), vitA: String(entry.vitA), vitB1: String(entry.vitB1),
      vitB2: String(entry.vitB2), vitC: String(entry.vitC), vitD: String(entry.vitD),
      vitE: String(entry.vitE), salt: String(entry.salt),
    })
    setNutQuery(entry.name)
    setShowNutSuggestions(false)
    setShowNutrition(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name || !form.unit || !form.pricePerUnit) {
      setError('食材名・単位・単価は必須です')
      return
    }

    const tsp = form.tspGrams ? parseFloat(form.tspGrams) : null
    const payload = {
      name: form.name,
      unit: form.unit,
      pricePerUnit: parseFloat(form.pricePerUnit),
      tspGrams: tsp,
      gramsPerUnit: form.gramsPerUnit ? parseFloat(form.gramsPerUnit) : null,
      // 栄養素
      ...Object.fromEntries(
        NUTRITION_FIELDS.map(f => [f.key, nutrition[f.key] !== '' ? parseFloat(nutrition[f.key]) : null])
      ),
    }

    const url = editId != null ? `/api/ingredients/${editId}` : '/api/ingredients'
    const method = editId != null ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? (editId != null ? '更新に失敗しました' : '登録に失敗しました'))
      return
    }

    setForm({ name: '', unit: 'g', pricePerUnit: '', tspGrams: '', gramsPerUnit: '' })
    setNutrition(emptyNutrition())
    setNutQuery('')
    setShowNutrition(false)
    setEditId(null)
    setShowForm(false)
    fetchIngredients()
  }

  const handleEdit = (ing: Ingredient) => {
    setForm({
      name: ing.name,
      unit: ing.unit,
      pricePerUnit: String(ing.pricePerUnit),
      tspGrams: ing.tspGrams != null ? String(ing.tspGrams) : '',
      gramsPerUnit: ing.gramsPerUnit != null ? String(ing.gramsPerUnit) : '',
    })
    const nut = emptyNutrition()
    for (const f of NUTRITION_FIELDS) {
      const v = ing[f.key as keyof Ingredient]
      nut[f.key] = v != null ? String(v) : ''
    }
    setNutrition(nut)
    setNutQuery('')
    const hasNut = NUTRITION_FIELDS.some(f => ing[f.key as keyof Ingredient] != null)
    setShowNutrition(hasNut)
    setEditId(ing.id)
    setShowForm(true)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\nこの食材を使用しているレシピにも影響があります。`)) return
    await fetch(`/api/ingredients/${id}`, { method: 'DELETE' })
    fetchIngredients()
  }

  const showConversionFields = WEIGHT_UNITS.includes(form.unit)
  const showGramsPerUnit = !WEIGHT_UNITS.includes(form.unit) && form.unit !== '' && !['大さじ', '小さじ', 'カップ'].includes(form.unit)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">食材マスタ</h1>
        <button
          onClick={() => {
            setShowForm(true); setEditId(null)
            setForm({ name: '', unit: 'g', pricePerUnit: '', tspGrams: '', gramsPerUnit: '' })
            setNutrition(emptyNutrition()); setNutQuery(''); setShowNutrition(false)
            setError('')
          }}
          className="bg-orange-500 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          + 食材を追加
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">
            {editId != null ? '食材を編集' : '新しい食材を追加'}
          </h2>
          <form onSubmit={handleSubmit}>
            {/* 基本情報 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">食材名</label>
                <input
                  type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例: 薄力粉"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">単位</label>
                <div className="flex gap-2">
                  <select
                    value={ALL_UNITS.includes(form.unit) ? form.unit : 'custom'}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value === 'custom' ? '' : e.target.value }))}
                    className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {ALL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    <option value="custom">その他</option>
                  </select>
                  {!ALL_UNITS.includes(form.unit) && (
                    <input
                      type="text" placeholder="単位" value={form.unit}
                      className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  単価（1{form.unit}あたりの金額 ¥）
                </label>
                <input
                  type="number" value={form.pricePerUnit}
                  onChange={e => setForm(f => ({ ...f, pricePerUnit: e.target.value }))}
                  placeholder="例: 0.3" step="0.001" min="0"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <p className="text-xs text-stone-400 mt-1">※ g単価の場合: 1kg=¥200なら 0.2</p>
              </div>
            </div>

            {/* 小さじ換算 */}
            {showConversionFields && (
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="text-sm font-semibold text-stone-700 mb-1">小さじ換算（任意）</p>
                <p className="text-xs text-stone-400 mb-3">
                  小さじ1の重さを入力すると、大さじ・小さじでコスト計算できます。大さじは自動的に小さじ×3で計算されます。
                </p>
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    小さじ1 = 何{form.unit}？
                  </label>
                  <input
                    type="number" value={form.tspGrams}
                    onChange={e => setForm(f => ({ ...f, tspGrams: e.target.value }))}
                    placeholder={form.unit === 'g' ? '例: 薄力粉3、砂糖4、塩6' : '例: 5'}
                    step="0.1" min="0"
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  {form.tspGrams && (
                    <p className="mt-1 text-xs text-stone-400">
                      → 大さじ1 = {(parseFloat(form.tspGrams) * 3).toFixed(1)}{form.unit}（自動計算）
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 1単位あたりのグラム数（個・本・枚などの単位用） */}
            {showGramsPerUnit && (
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="text-sm font-semibold text-stone-700 mb-1">
                  重量換算（任意）
                </p>
                <p className="text-xs text-stone-400 mb-3">
                  1{form.unit || '単位'}あたりのグラム数を入力すると、栄養素計算が行えます。
                  （例: 卵1個 = 60g、にんじん1本 = 100g）
                </p>
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    1{form.unit || '単位'} = 何g？
                  </label>
                  <input
                    type="number" value={form.gramsPerUnit}
                    onChange={e => setForm(f => ({ ...f, gramsPerUnit: e.target.value }))}
                    placeholder="例: 卵→60、にんじん→100"
                    step="1" min="0"
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
            )}

            {/* 栄養素セクション */}
            <div className="mt-5 border-t border-stone-100 pt-4">
              <button
                type="button"
                onClick={() => setShowNutrition(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-stone-700 hover:text-orange-600"
              >
                <span className={`transition-transform ${showNutrition ? 'rotate-90' : ''}`}>▶</span>
                栄養素情報を設定（任意）
                <span className="text-xs font-normal text-stone-400 ml-1">100gあたり・日本食品成分表準拠</span>
              </button>

              {showNutrition && (
                <div className="mt-4">
                  {/* オートフィル検索 */}
                  <div className="mb-4 relative" ref={nutRef}>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      食品成分表から検索して自動入力
                    </label>
                    <input
                      type="text"
                      value={nutQuery}
                      onChange={e => setNutQuery(e.target.value)}
                      onFocus={() => nutQuery && setShowNutSuggestions(true)}
                      placeholder="例: 薄力粉、卵、鶏むね肉..."
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    {showNutSuggestions && nutSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                        {nutSuggestions.map(entry => (
                          <button
                            key={entry.name}
                            type="button"
                            onMouseDown={() => applyFoodEntry(entry)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-orange-50 border-b border-stone-50 last:border-0"
                          >
                            <span className="font-medium text-stone-800">{entry.name}</span>
                            <span className="text-xs text-stone-400 ml-2">
                              {entry.kcal}kcal / たんぱく質{entry.protein}g / 脂質{entry.fat}g
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-stone-400 mt-1">
                      検索して選択すると自動入力されます。手動で修正することもできます。
                    </p>
                  </div>

                  {/* 栄養素入力フィールド */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {NUTRITION_FIELDS.map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          {f.label}
                          <span className="text-stone-400 ml-1">({f.unit})</span>
                        </label>
                        <input
                          type="number"
                          value={nutrition[f.key]}
                          onChange={e => setNutrition(n => ({ ...n, [f.key]: e.target.value }))}
                          step="0.01" min="0"
                          placeholder="—"
                          className="w-full border border-stone-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button type="submit"
                className="bg-orange-500 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors">
                {editId != null ? '更新する' : '登録する'}
              </button>
              <button type="button"
                onClick={() => { setShowForm(false); setEditId(null); setError('') }}
                className="bg-stone-100 text-stone-700 px-5 py-2 rounded-full text-sm font-medium hover:bg-stone-200 transition-colors">
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {ingredients.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="text-4xl mb-3">🥕</p>
          <p className="text-base">食材がまだ登録されていません</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-semibold text-stone-700">食材名</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700">単位・単価</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700 hidden sm:table-cell">換算</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700 hidden md:table-cell">栄養素（100g）</th>
                <th className="text-right px-4 py-3 font-semibold text-stone-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing, i) => {
                const hasNut = ing.kcal != null || ing.protein != null
                return (
                  <tr key={ing.id} className={`border-b border-stone-100 ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}`}>
                    <td className="px-4 py-3 font-medium text-stone-800">{ing.name}</td>
                    <td className="px-4 py-3 text-stone-600">
                      ¥{ing.pricePerUnit.toLocaleString(undefined, { maximumFractionDigits: 4 })} / {ing.unit}
                      {ing.tspGrams != null && (
                        <div className="sm:hidden mt-0.5 text-xs text-stone-400">
                          小さじ1={ing.tspGrams}{ing.unit}、大さじ1={ing.tspGrams * 3}{ing.unit}
                        </div>
                      )}
                      {ing.gramsPerUnit != null && (
                        <div className="sm:hidden mt-0.5 text-xs text-stone-400">
                          1{ing.unit}={ing.gramsPerUnit}g
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-400 text-xs hidden sm:table-cell">
                      {ing.tspGrams != null ? (
                        <>
                          <span className="mr-3">小さじ1={ing.tspGrams}{ing.unit}</span>
                          <span>大さじ1={ing.tspGrams * 3}{ing.unit}</span>
                        </>
                      ) : WEIGHT_UNITS.includes(ing.unit) ? (
                        <span className="text-stone-300">未設定</span>
                      ) : ing.gramsPerUnit != null ? (
                        <span>1{ing.unit}={ing.gramsPerUnit}g</span>
                      ) : !['大さじ', '小さじ', 'カップ'].includes(ing.unit) ? (
                        <span className="text-stone-300">未設定</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs hidden md:table-cell">
                      {hasNut ? (
                        <span className="text-stone-500">
                          {ing.kcal != null && <span className="mr-2">{ing.kcal}kcal</span>}
                          {ing.protein != null && <span className="mr-2">P:{ing.protein}g</span>}
                          {ing.fat != null && <span className="mr-2">F:{ing.fat}g</span>}
                          {ing.carbs != null && <span>C:{ing.carbs}g</span>}
                        </span>
                      ) : (
                        <span className="text-stone-300">未設定</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEdit(ing)}
                        className="text-blue-600 hover:text-blue-800 mr-3 text-xs font-medium">編集</button>
                      <button onClick={() => handleDelete(ing.id, ing.name)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium">削除</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
