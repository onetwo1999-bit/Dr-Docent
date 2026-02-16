/**
 * 내부 DB(food_knowledge) 검색 — 관리 팁·레시피용
 * USDA는 정확한 영양 수치, 내부 DB는 관리 팁·레시피 역할 분담
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type FoodKnowledgeRow = {
  food_name: string
  clinical_insight: string | null
  synthetic_qa: string | null
  calories?: number | null
  protein?: number | null
  fat?: number | null
  carbs?: number | null
  sodium?: number | null
}

export async function searchFoodKnowledge(
  supabase: SupabaseClient,
  query: string,
  limit: number = 5
): Promise<FoodKnowledgeRow[]> {
  const term = query.trim().replace(/\s+/g, '%')
  if (!term) return []
  const pattern = `%${term}%`
  try {
    const { data, error } = await supabase
      .from('food_knowledge')
      .select('food_name, clinical_insight, synthetic_qa, calories, protein, fat, carbs, sodium')
      .ilike('food_name', pattern)
      .limit(limit)
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}
