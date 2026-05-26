'use client'

import { useState, useEffect, useCallback } from 'react'

interface Ingredient {
  id: number
  name: string
  unit: string
  pricePerUnit: number
  tbspGrams: number | null
  tspGrams: number | null
}

const WEIGHT_UNITS = ['g', 'ml']
const ALL_UNITS = ['g', 'ml', '個', '枚', '本', '袋', '缶', '大さじ', '小さじ', 'カップ']

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', unit: 'g', pricePerUnit: '', tbspGrams: '', tspGrams: '' })
  const [error, setError] = useState('')

  const fetchIngredients = useCallback(async () => {
    const res = await fetch('/api/ingredients')
    const data = await res.json()
    setIngredients(data)
  }, [])

  useEffect(() => { fetchIngredients() }, [fetchIngredients])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name || !form.unit || !form.pricePerUnit) {
      setError('食材名・単位・単価は必須です')
      return
    }

    const payload = {
      name: form.name,
      unit: form.unit,
      pricePerUnit: parseFloat(form.pricePerUnit),
      tbspGrams: form.tbspGrams ? parseFloat(form.tbspGrams) : null,
      tspGrams: form.tspGrams ? parseFloat(form.tspGrams) : null,
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

    setForm({ name: '', unit: 'g', pricePerUnit: '', tbspGrams: '', tspGrams: '' })
    setEditId(null)
    setShowForm(false)
    fetchIngredients()
  }

  const handleEdit = (ing: Ingredient) => {
    setForm({
      name: ing.name,
      unit: ing.unit,
      pricePerUnit: String(ing.pricePerUnit),
      tbspGrams: ing.tbspGrams != null ? String(ing.tbspGrams) : '',
      tspGrams: ing.tspGrams != null ? String(ing.tspGrams) : '',
    })
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">食材マスタ</h1>
        <button
          onClick={() => {
            setShowForm(true); setEditId(null)
            setForm({ name: '', unit: 'g', pricePerUnit: '', tbspGrams: '', tspGrams: '' })
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
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value === 'custom' ? '' : e.target.value, tbspGrams: '', tspGrams: '' }))}
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
                <p className="text-xs text-stone-400 mt-1">
                  ※ g単価の場合: 1kg=¥200なら 0.2
                </p>
              </div>
            </div>

            {/* 大さじ・小さじ換算（g/mlのときのみ表示） */}
            {showConversionFields && (
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="text-sm font-semibold text-stone-700 mb-1">
                  大さじ・小さじ換算（任意）
                </p>
                <p className="text-xs text-stone-400 mb-3">
                  入力しておくと、レシピ登録時に大さじ・小さじでコスト計算できます
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      大さじ1 = 何{form.unit}？
                    </label>
                    <input
                      type="number" value={form.tbspGrams}
                      onChange={e => setForm(f => ({ ...f, tbspGrams: e.target.value }))}
                      placeholder={form.unit === 'g' ? '例: 薄力粉9、砂糖12、塩18' : '例: 15'}
                      step="0.1" min="0"
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
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
                  </div>
                </div>
              </div>
            )}

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
                <th className="text-right px-4 py-3 font-semibold text-stone-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing, i) => (
                <tr key={ing.id} className={`border-b border-stone-100 ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}`}>
                  <td className="px-4 py-3 font-medium text-stone-800">{ing.name}</td>
                  <td className="px-4 py-3 text-stone-600">
                    ¥{ing.pricePerUnit.toLocaleString(undefined, { maximumFractionDigits: 4 })} / {ing.unit}
                    {/* スマホでは換算をここに表示 */}
                    {(ing.tbspGrams != null || ing.tspGrams != null) && (
                      <div className="sm:hidden mt-0.5 text-xs text-stone-400">
                        {ing.tbspGrams != null && <span className="mr-2">大さじ1={ing.tbspGrams}{ing.unit}</span>}
                        {ing.tspGrams != null && <span>小さじ1={ing.tspGrams}{ing.unit}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-400 text-xs hidden sm:table-cell">
                    {ing.tbspGrams != null && <span className="mr-3">大さじ1={ing.tbspGrams}{ing.unit}</span>}
                    {ing.tspGrams != null && <span>小さじ1={ing.tspGrams}{ing.unit}</span>}
                    {ing.tbspGrams == null && ing.tspGrams == null && WEIGHT_UNITS.includes(ing.unit) && (
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
