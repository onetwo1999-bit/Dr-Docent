/**
 * 의약품 RAG 파이프라인
 *
 * 데이터 흐름:
 *   1) Supabase `drugs` 테이블 캐시 조회 (e약은요 데이터)
 *   2) 캐시 미스 → MFDS_DRUG_INFO_API_KEY로 식약처 e약은요 API 실시간 호출
 *   3) 결과를 `drugs` 테이블에 저장 후 LLM 프롬프트용으로 포맷
 *
 * 중요:
 *   - MFDS_DRUG_INFO_API_KEY 미설정 시 null 반환 (일반 지식 답변 금지)
 *   - 출처 표기 '식품의약품안전처 공공데이터'는 buildSystemPrompt에서 강제
 */

import { fetchDrugListByProductName, saveDrugsToDb, type MfdsDrugItem } from './mfds-drug-api'

type SupabaseAdmin = ReturnType<typeof import('@/utils/supabase/admin').createAdminClient>

/** drugs 테이블 조회 결과 */
type DrugCacheRow = {
  item_seq?: string | null
  product_name?: string | null
  company_name?: string | null
  efficacy?: string | null
  use_method?: string | null
  precautions_warn?: string | null
  precautions?: string | null
  interaction?: string | null
  side_effect?: string | null
}

/** 길이 제한 헬퍼 */
function clip(s: string | null | undefined, max: number): string | null {
  if (!s) return null
  return s.length > max ? s.slice(0, max) + '…' : s
}

/** DrugCacheRow → MfdsDrugItem 변환 */
function rowToItem(r: DrugCacheRow): MfdsDrugItem {
  return {
    itemSeq: r.item_seq ?? '',
    productName: r.product_name ?? '',
    companyName: r.company_name ?? '',
    efficacy: r.efficacy ?? null,
    useMethod: r.use_method ?? null,
    precautionsWarn: r.precautions_warn ?? null,
    precautions: r.precautions ?? null,
    interaction: r.interaction ?? null,
    sideEffect: r.side_effect ?? null,
    storageMethod: null,
    itemImage: null,
    ingredients: null,
    openDe: null,
    updateDe: null,
  }
}

/** MfdsDrugItem 배열 → 시스템 프롬프트 삽입용 텍스트 */
export function formatDrugContextForPrompt(items: MfdsDrugItem[]): string {
  const lines: string[] = []
  for (const item of items.slice(0, 2)) {
    lines.push(`■ 제품명: ${item.productName || '(정보 없음)'}`)
    if (item.companyName) lines.push(`  제조사: ${item.companyName}`)
    const efficacy = clip(item.efficacy, 500)
    const useMethod = clip(item.useMethod, 400)
    const precautionsWarn = clip(item.precautionsWarn, 300)
    const precautions = clip(item.precautions, 400)
    const interaction = clip(item.interaction, 300)
    const sideEffect = clip(item.sideEffect, 300)
    if (efficacy) lines.push(`  효능·효과: ${efficacy}`)
    if (useMethod) lines.push(`  용법·용량: ${useMethod}`)
    if (precautionsWarn) lines.push(`  ⚠️ 경고: ${precautionsWarn}`)
    if (precautions) lines.push(`  주의사항: ${precautions}`)
    if (interaction) lines.push(`  상호작용: ${interaction}`)
    if (sideEffect) lines.push(`  이상반응: ${sideEffect}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}

export type DrugRagResult = {
  drugContext: string | null
  /** API를 실제로 호출했으면 true (캐시 히트면 false) */
  apiUsed: boolean
  /** 검색된 아이템 수 */
  itemCount: number
}

/**
 * 의약품 RAG 실행:
 *   1. Supabase drugs 테이블 캐시 조회
 *   2. 미스 → MFDS 식약처 e약은요 API 실시간 호출 + 저장
 *   3. 프롬프트용 텍스트 반환
 *
 * MFDS_DRUG_INFO_API_KEY 없으면 null 반환 → LLM에게 '데이터 없음' 알림
 */
export async function runDrugRag(
  requestId: string,
  drugQuery: string,
  supabaseAdmin: SupabaseAdmin
): Promise<DrugRagResult> {
  // 이 함수는 API Route(서버)에서만 호출됨. process.env는 서버 런타임의 환경변수를 참조.
  console.log(`[${requestId}] [runDrugRag] URL:`, process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(undefined)')
  console.log(`[${requestId}] [runDrugRag] ServiceKey Exist:`, !!process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log(`[${requestId}] [runDrugRag] MFDS_DRUG_INFO_API_KEY Exist:`, !!process.env.MFDS_DRUG_INFO_API_KEY)

  // 서버 전용. 키 이름은 반드시 대문자 MFDS_DRUG_INFO_API_KEY (Vercel/로컬 동일)
  const apiKey = process.env.MFDS_DRUG_INFO_API_KEY?.trim()

  if (!apiKey) {
    console.warn(`⚠️ [${requestId}] MFDS_DRUG_INFO_API_KEY 미설정 — 약물 RAG 생략`)
    return { drugContext: null, apiUsed: false, itemCount: 0 }
  }

  let items: MfdsDrugItem[] = []
  let apiUsed = false

  // ── 1. Supabase drugs 테이블 캐시 조회 ─────────────────────────
  try {
    const { data: cached, error } = await supabaseAdmin
      .from('drugs')
      .select(
        'item_seq, product_name, company_name, efficacy, use_method, precautions_warn, precautions, interaction, side_effect'
      )
      .ilike('product_name', `%${drugQuery}%`)
      .limit(3)

    if (!error && Array.isArray(cached) && cached.length > 0) {
      console.log(`💊 [${requestId}] drugs 캐시 히트: ${cached.length}건 (쿼리: "${drugQuery}")`)
      items = (cached as DrugCacheRow[]).map(rowToItem)
    }
  } catch (err) {
    console.warn(`⚠️ [${requestId}] drugs 테이블 조회 실패 (무시):`, err)
  }

  // ── 2. 캐시 미스 → MFDS API 실시간 호출 ──────────────────────
  if (items.length === 0) {
    console.log(`🌐 [${requestId}] MFDS e약은요 API 호출: "${drugQuery}"`)
    try {
      const result = await fetchDrugListByProductName(apiKey, drugQuery, {
        pageNo: 1,
        numOfRows: 3,
      })
      items = result.items
      apiUsed = true
      console.log(`💊 [${requestId}] MFDS API 반환: ${items.length}건`)

      // 결과 캐시 저장 (실패해도 답변 진행)
      if (items.length > 0) {
        saveDrugsToDb(supabaseAdmin, items).catch((e) =>
          console.warn(`⚠️ [${requestId}] drugs 캐시 저장 실패 (무시):`, e)
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`❌ [${requestId}] MFDS API 호출 실패:`, msg)
      // API 호출 실패 시 null 반환 → LLM이 '조회 불가' 안내
      return { drugContext: null, apiUsed: false, itemCount: 0 }
    }
  }

  if (items.length === 0) {
    console.log(`📋 [${requestId}] 약물 정보 없음 (검색어: "${drugQuery}")`)
    return { drugContext: null, apiUsed, itemCount: 0 }
  }

  const drugContext = formatDrugContextForPrompt(items)
  return { drugContext, apiUsed, itemCount: items.length }
}
