import { NextRequest } from 'next/server'
import data from '@/data/food-composition.json'

interface FoodEntry {
  name: string
  kcal: number; protein: number; fat: number; carbs: number; fiber: number
  calcium: number; iron: number; vitA: number; vitB1: number; vitB2: number
  vitC: number; vitD: number; vitE: number; salt: number
}

const entries = data as FoodEntry[]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''

  if (!q) return Response.json([])

  const lower = q.toLowerCase()
  const results = entries
    .filter(e => e.name.toLowerCase().includes(lower))
    .slice(0, 8)

  return Response.json(results)
}
