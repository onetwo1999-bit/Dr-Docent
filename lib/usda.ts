/**
 * USDA FoodData Central API 유틸리티
 * .env.local의 USDA_API_KEY 사용. 식품 검색 및 100g당 영양 성분 조회.
 */

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'

export type UsdaNutrientsPer100g = {
  energy_kcal: number
  protein_g: number
  carbohydrate_g: number
  fat_g: number
  fiber_g?: number | null
  sugar_g?: number | null
  sodium_mg?: number | null
  calcium_mg?: number | null
  iron_mg?: number | null
  potassium_mg?: number | null
  vitamin_c_mg?: number | null
  vitamin_a_iu?: number | null
  vitamin_d_ug?: number | null
  magnesium_mg?: number | null
  vitamin_a_rae_ug?: number | null
  vitamin_k_ug?: number | null
  choline_mg?: number | null
  [key: string]: number | null | undefined
}

export type UsdaFoodItem = {
  fdcId: number
  description: string
  dataType: string
  servingSize: number
  servingSizeUnit: string
  foodNutrients: Array<{
    nutrientId: number
    nutrientName: string
    unitName: string
    value: number
  }>
}

export type UsdaSearchResult = {
  totalHits: number
  foods: UsdaFoodItem[]
}

/** USDA 검색 API: 식재료 키워드로 식품 목록 조회 */
export async function searchFood(
  apiKey: string,
  query: string,
  pageSize: number = 10
): Promise<UsdaSearchResult> {
  if (!apiKey?.trim()) throw new Error('USDA_API_KEY is required')
  const url = `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(apiKey.trim())}&query=${encodeURIComponent(query.trim())}&pageSize=${pageSize}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`USDA search failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return {
    totalHits: data.totalHits ?? 0,
    foods: (data.foods ?? []).map((f: any) => ({
      fdcId: f.fdcId,
      description: f.description ?? '',
      dataType: f.dataType ?? '',
      servingSize: typeof f.servingSize === 'number' ? f.servingSize : 100,
      servingSizeUnit: f.servingSizeUnit ?? 'g',
      foodNutrients: (f.foodNutrients ?? []).map((n: any) => ({
        nutrientId: n.nutrientId,
        nutrientName: n.nutrientName ?? '',
        unitName: n.unitName ?? '',
        value: typeof n.value === 'number' ? n.value : 0,
      })),
    })),
  }
}

/** nutrientId → 100g 기준 키 (한국인 익숙 단위: g, mg, kcal) */
const NUTRIENT_IDS: Record<number, keyof UsdaNutrientsPer100g> = {
  1008: 'energy_kcal',
  1003: 'protein_g',
  1005: 'carbohydrate_g',
  1004: 'fat_g',
  1079: 'fiber_g',
  2000: 'sugar_g',
  1093: 'sodium_mg',
  1087: 'calcium_mg',
  1089: 'iron_mg',
  1092: 'potassium_mg',
  1162: 'vitamin_c_mg',
  1104: 'vitamin_a_iu',
  1114: 'vitamin_d_ug',
  1106: 'vitamin_a_rae_ug',
  1090: 'magnesium_mg',
  1180: 'choline_mg',
  1185: 'vitamin_k_ug',
}

/** 검색된 식품 1건에 대해 100g당 영양 성분 객체 생성 (g, mg, kcal 통일) */
export function getNutrientsPer100g(food: UsdaFoodItem): UsdaNutrientsPer100g {
  const servingG = food.servingSizeUnit?.toUpperCase() === 'G' ? food.servingSize : 100
  const ratio = servingG > 0 ? 100 / servingG : 1

  const out: UsdaNutrientsPer100g = {
    energy_kcal: 0,
    protein_g: 0,
    carbohydrate_g: 0,
    fat_g: 0,
    fiber_g: null,
    sugar_g: null,
    sodium_mg: null,
    calcium_mg: null,
    iron_mg: null,
    potassium_mg: null,
    vitamin_c_mg: null,
    vitamin_a_iu: null,
    vitamin_d_ug: null,
  }

  for (const n of food.foodNutrients) {
    const key = NUTRIENT_IDS[n.nutrientId]
    if (key) {
      const value = Math.round(n.value * ratio * 100) / 100
      ;(out as Record<string, number | null>)[key] = value
    }
  }

  return out
}

/** 검색 후 상위 1~2건에 대해 100g당 영양 데이터 반환 (프롬프트 주입용) */
export function searchAndGetNutrients(
  apiKey: string,
  query: string,
  maxFoods: number = 2
): Promise<{ description: string; nutrients: UsdaNutrientsPer100g }[]> {
  return searchFood(apiKey, query, Math.max(5, maxFoods)).then((result) => {
    return result.foods.slice(0, maxFoods).map((food) => ({
      description: food.description,
      nutrients: getNutrientsPer100g(food),
    }))
  })
}

/** 프롬프트에 넣을 USDA 영양 텍스트 포맷 (한국어 단위: g, mg, kcal) */
export function formatUsdaContextForPrompt(
  items: { description: string; nutrients: UsdaNutrientsPer100g }[]
): string {
  return items
    .map((item) => {
      const n = item.nutrients
      const lines = [
        `[${item.description}] 100g당:`,
        `  에너지 ${n.energy_kcal} kcal, 단백질 ${n.protein_g} g, 탄수화물 ${n.carbohydrate_g} g, 지방 ${n.fat_g} g`,
      ]
      if (n.fiber_g != null) lines.push(`  식이섬유 ${n.fiber_g} g`)
      if (n.sugar_g != null) lines.push(`  당류 ${n.sugar_g} g`)
      if (n.sodium_mg != null) lines.push(`  나트륨 ${n.sodium_mg} mg`)
      if (n.calcium_mg != null) lines.push(`  칼슘 ${n.calcium_mg} mg`)
      if (n.potassium_mg != null) lines.push(`  칼륨 ${n.potassium_mg} mg`)
      if (n.iron_mg != null) lines.push(`  철 ${n.iron_mg} mg`)
      if (n.vitamin_c_mg != null) lines.push(`  비타민 C ${n.vitamin_c_mg} mg`)
      if (n.vitamin_a_iu != null) lines.push(`  비타민 A ${n.vitamin_a_iu} IU`)
      if (n.vitamin_d_ug != null) lines.push(`  비타민 D ${n.vitamin_d_ug} µg`)
      return lines.join('\n')
    })
    .join('\n\n')
}
