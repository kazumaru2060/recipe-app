'use client'

import { useState, useEffect, useCallback } from 'react'

interface Ingredient {
  id: number
  name: string
  unit: string
  pricePerUnit: number
}

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', unit: 'g', pricePerUnit: '' })
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
      setError('すべての項目を入力してください')
      return
    }

    if (editId != null) {
      const res = await fetch(`/api/ingredients/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pricePerUnit: parseFloat(form.pricePerUnit) }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '更新に失敗しました')
        return
      }
    } else {
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pricePerUnit: parseFloat(form.pricePerUnit) }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '登録に失敗しました')
        return
      }
    }

    setForm({ name: '', unit: 'g', pricePerUnit: '' })
    setEditId(null)
    setShowForm(false)
    fetchIngredients()
  }

  const handleEdit = (ing: Ingredient) => {
    setForm({ name: ing.name, unit: ing.unit, pricePerUnit: String(ing.pricePerUnit) })
    setEditId(ing.id)
    setShowForm(true)
    setError('')
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\nこの食材を使用しているレシピにも影響があります。`)) return
    await fetch(`/api/ingredients/${id}`, { method: 'DELETE' })
    fetchIngredients()
  }

  const commonUnits = ['g', 'ml', '個', '枚', '本', '袋', '缶', '大さじ', '小さじ', 'カップ']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">食材マスタ</h1>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', unit: 'g', pricePerUnit: '' }); setError('') }}
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
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例: 薄力粉"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">単位</label>
                <div className="flex gap-2">
                  <select
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {commonUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    <option value="custom">その他</option>
                  </select>
                  {form.unit === 'custom' && (
                    <input
                      type="text"
                      placeholder="単位"
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
                  type="number"
                  value={form.pricePerUnit}
                  onChange={e => setForm(f => ({ ...f, pricePerUnit: e.target.value }))}
                  placeholder="例: 0.3"
                  step="0.01"
                  min="0"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <p className="text-xs text-stone-400 mt-1">
                  ※ g単価の場合: 1kg=¥200なら 0.2
                </p>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                className="bg-orange-500 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                {editId != null ? '更新する' : '登録する'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditId(null); setError('') }}
                className="bg-stone-100 text-stone-700 px-5 py-2 rounded-full text-sm font-medium hover:bg-stone-200 transition-colors"
              >
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
                <th className="text-left px-4 py-3 font-semibold text-stone-700">単位</th>
                <th className="text-left px-4 py-3 font-semibold text-stone-700">単価</th>
                <th className="text-right px-4 py-3 font-semibold text-stone-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing, i) => (
                <tr key={ing.id} className={`border-b border-stone-100 ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}`}>
                  <td className="px-4 py-3 font-medium text-stone-800">{ing.name}</td>
                  <td className="px-4 py-3 text-stone-600">{ing.unit}</td>
                  <td className="px-4 py-3 text-stone-600">
                    ¥{ing.pricePerUnit.toLocaleString(undefined, { maximumFractionDigits: 4 })} / {ing.unit}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(ing)}
                      className="text-blue-600 hover:text-blue-800 mr-3 text-xs font-medium"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(ing.id, ing.name)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      削除
                    </button>
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
