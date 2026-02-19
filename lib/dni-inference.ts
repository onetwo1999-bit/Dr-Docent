/**
 * DNI(Drug-Nutrient Interaction) 추론 엔진
 * 음식 검색·식단 사진 시: user_medications → drug_master 성분 조회 → dni_logic 주의 영양소와
 * USDA 영양 데이터 비교 → 충돌 시 '데이터 기반 주의 가이드' 메시지 생성 (확진/진단 아님).
 */

import type { UsdaNutrientsPer100g } from './usda'

/** USDA nutrient 키 → dni_logic.target_nutrient 매칭용 한글명 (다양한 표기 수용) */
const NUTRIENT_TO_LABELS: Record<string, string[]> = {
  potassium_mg: ['칼륨', '포타슘', 'potassium'],
  sodium_mg: ['나트륨', '소듐', 'sodium'],
  calcium_mg: ['칼슘', 'calcium'],
  magnesium_mg: ['마그네슘', 'magnesium'],
  iron_mg: ['철', '철분', 'iron'],
  vitamin_k_ug: ['비타민K', '비타민 K', '비타민K1', 'vitamin K'],
  vitamin_d_ug: ['비타민D', '비타민 D', 'vitamin D'],
  vitamin_c_mg: ['비타민C', '비타민 C', 'vitamin C'],
  vitamin_a_iu: ['비타민A', '비타민 A', 'vitamin A'],
  vitamin_a_rae_ug: ['비타민A', '비타민 A'],
  fiber_g: ['식이섬유', '섬유질', 'fiber'],
  sugar_g: ['당', '당류', 'sugar'],
}

export type DniRule = {
  ingredient_name: string
  target_nutrient: string
  warning_level: string
  message: string | null
}

export type DniConflict = {
  ingredient_name: string
  target_nutrient: string
  warning_level: string
  message: string | null
  nutrientValue: number
  nutrientUnit: string
}

export type DniInferenceResult = {
  hasConflict: boolean
  conflicts: DniConflict[]
  cautionGuideMessage: string | null
}

/** 현재 유저의 복용 중인 약 → drug_master와 조인해 성분명 목록 반환 */
export async function getActiveMedicationIngredients(
  supabase: any,
  userId: string
): Promise<{ product_name: string; main_ingredient: string | null }[]> {
  const { data: meds, error } = await supabase
    .from('user_medications')
    .select('drug_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error || !meds?.length) return []

  const drugIds = meds.map((m: { drug_id: string }) => m.drug_id)
  const { data: drugs, error: drugError } = await supabase
    .from('drug_master')
    .select('product_name, main_ingredient')
    .in('id', drugIds)

  if (drugError || !drugs?.length) return []
  return drugs.filter((d: { main_ingredient: string | null }) => d.main_ingredient?.trim())
}

/** 성분명 목록에 해당하는 dni_logic 규칙 조회 */
export async function getDniRulesByIngredients(
  supabase: any,
  ingredientNames: string[]
): Promise<DniRule[]> {
  const names = ingredientNames.map((n) => n?.trim()).filter(Boolean)
  if (!names.length) return []

  const { data, error } = await supabase
    .from('dni_logic')
    .select('ingredient_name, target_nutrient, warning_level, message')
    .in('ingredient_name', names)

  if (error || !data?.length) return []
  return data
}

/** USDA 영양 데이터(100g당)를 '주의 영양소' 매칭용 맵으로 변환. 키: 한글/영문 영양소명, 값: 수치 */
function buildFoodNutrientMap(
  usdaItems: { description: string; nutrients: UsdaNutrientsPer100g }[]
): Map<string, { value: number; unit: string }> {
  const map = new Map<string, { value: number; unit: string }>()
  const unitByKey: Record<string, string> = {
    potassium_mg: 'mg',
    sodium_mg: 'mg',
    calcium_mg: 'mg',
    magnesium_mg: 'mg',
    iron_mg: 'mg',
    vitamin_k_ug: 'µg',
    vitamin_d_ug: 'µg',
    vitamin_c_mg: 'mg',
    vitamin_a_iu: 'IU',
    vitamin_a_rae_ug: 'µg',
    fiber_g: 'g',
    sugar_g: 'g',
  }
  for (const item of usdaItems) {
    const n = item.nutrients
    for (const [key, labels] of Object.entries(NUTRIENT_TO_LABELS)) {
      const raw = (n as Record<string, number | null | undefined>)[key]
      const value = typeof raw === 'number' && !Number.isNaN(raw) ? raw : 0
      if (value <= 0) continue
      const unit = unitByKey[key] ?? 'g'
      for (const label of labels) {
        const existing = map.get(label)
        if (existing == null || value > existing.value) map.set(label, { value, unit })
      }
      const normalizedTarget = labels[0]
      if (!map.has(normalizedTarget)) map.set(normalizedTarget, { value, unit })
    }
  }
  return map
}

/** target_nutrient가 음식 영양 맵에 있는지 확인 (유사 매칭: 공백/대소문자 무시) */
function findMatchingNutrientValue(
  targetNutrient: string,
  foodMap: Map<string, { value: number; unit: string }>
): { value: number; unit: string } | null {
  const t = targetNutrient?.trim()
  if (!t) return null
  const normalized = t.replace(/\s+/g, ' ').toLowerCase()
  for (const [label, entry] of foodMap) {
    if (label.replace(/\s+/g, ' ').toLowerCase() === normalized) return entry
    if (label.replace(/\s+/g, '').toLowerCase() === normalized.replace(/\s+/g, '')) return entry
  }
  if (foodMap.has(t)) return foodMap.get(t)! 
  return null
}

/** DNI 규칙과 음식 영양 데이터 비교 → 충돌 목록 */
export function getDniConflicts(
  dniRules: DniRule[],
  usdaItems: { description: string; nutrients: UsdaNutrientsPer100g }[]
): DniConflict[] {
  const foodMap = buildFoodNutrientMap(usdaItems)
  const conflicts: DniConflict[] = []
  for (const rule of dniRules) {
    const entry = findMatchingNutrientValue(rule.target_nutrient, foodMap)
    if (entry && entry.value > 0) {
      conflicts.push({
        ingredient_name: rule.ingredient_name,
        target_nutrient: rule.target_nutrient,
        warning_level: rule.warning_level,
        message: rule.message,
        nutrientValue: entry.value,
        nutrientUnit: entry.unit,
      })
    }
  }
  return conflicts
}

/** 법적 리스크 회피용 '데이터 기반 주의 가이드' 문구 생성. 확진/진단 표현 금지 */
export function buildCautionGuideMessage(conflicts: DniConflict[]): string {
  if (!conflicts.length) return ''
  const lines: string[] = [
    '【데이터 기반 주의 가이드】',
    '복용 중인 약과 이 음식의 영양 성분 데이터를 비교한 결과, 아래 내용은 참고용으로만 활용해 주세요. 진단이나 확정적 결론이 아니며, 개인별 상담이 필요하면 의료진·약사에게 문의하시기 바랍니다.',
  ]
  for (const c of conflicts) {
    const msg = c.message?.trim() || `${c.target_nutrient} 함유 음식과 ${c.ingredient_name} 복용 시 주의가 권장될 수 있습니다.`
    lines.push(`· ${c.target_nutrient}(이)가 100g당 약 ${c.nutrientValue}${c.nutrientUnit} 포함된 데이터가 있습니다. ${msg}`)
  }
  lines.push('위 내용은 참고용 가이드이며, 확진이 아닙니다.')
  return lines.join('\n')
}

/**
 * DNI 추론 엔진 진입점.
 * 유저 복용 약 성분 → dni_logic 규칙 조회 → USDA 음식 영양과 비교 → 충돌 시 주의 가이드 메시지 반환.
 */
export async function runDniInference(
  supabase: any,
  userId: string,
  usdaItems: { description: string; nutrients: UsdaNutrientsPer100g }[]
): Promise<DniInferenceResult> {
  if (!usdaItems?.length) {
    return { hasConflict: false, conflicts: [], cautionGuideMessage: null }
  }

  const ingredients = await getActiveMedicationIngredients(supabase, userId)
  const ingredientNames = [...new Set(ingredients.map((i) => i.main_ingredient).filter(Boolean) as string[])]
  if (!ingredientNames.length) {
    return { hasConflict: false, conflicts: [], cautionGuideMessage: null }
  }

  const dniRules = await getDniRulesByIngredients(supabase, ingredientNames)
  if (!dniRules.length) {
    return { hasConflict: false, conflicts: [], cautionGuideMessage: null }
  }

  const conflicts = getDniConflicts(dniRules, usdaItems)
  const cautionGuideMessage = conflicts.length > 0 ? buildCautionGuideMessage(conflicts) : null

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    cautionGuideMessage,
  }
}
