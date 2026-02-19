/**
 * 의약품 RAG 파이프라인
 *
 * 데이터 흐름:
 *   식약처 DrugPrdtPrmsnInfoService07 getDrugPrdtMcpnDtlInq07 호출
 *   → PRDUCT(제품명), MTRAL_NM(성분명), ENTRPS(업체명) 매핑 후 LLM 프롬프트용 포맷
 *
 * 중요:
 *   - MFDS_DRUG_INFO_API_KEY 미설정 시 null 반환 (일반 지식 답변 금지)
 *   - 출처 표기 '식품의약품안전처 공공데이터'는 buildSystemPrompt에서 강제
 */

import { fetchDrugPrdtMcpnDtlInq07, type MfdsMcpn07Item } from './mfds-drug-mcpn07'

type SupabaseAdmin = ReturnType<typeof import('@/utils/supabase/admin').createAdminClient>

/** 길이 제한 헬퍼 */
function clip(s: string | null | undefined, max: number): string | null {
  if (!s) return null
  return s.length > max ? s.slice(0, max) + '…' : s
}

/** MfdsMcpn07Item 배열 → 시스템 프롬프트 삽입용 텍스트 (제품명·성분명·업체명) */
export function formatDrugContextForPrompt(items: MfdsMcpn07Item[]): string {
  const lines: string[] = []
  for (const item of items.slice(0, 5)) {
    lines.push(`■ 제품명: ${item.productName || '(정보 없음)'}`)
    if (item.ingredientName) lines.push(`  성분명: ${clip(item.ingredientName, 300)}`)
    if (item.companyName) lines.push(`  업체명: ${item.companyName}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}

export type DrugRagResult = {
  drugContext: string | null
  apiUsed: boolean
  itemCount: number
}

/**
 * 의약품 RAG 실행:
 *   MFDS getDrugPrdtMcpnDtlInq07 (JSON, serviceKey 그대로) 호출
 *   → PRDUCT, MTRAL_NM, ENTRPS 매핑 후 프롬프트용 텍스트 반환
 */
export async function runDrugRag(
  requestId: string,
  drugQuery: string,
  _supabaseAdmin: SupabaseAdmin
): Promise<DrugRagResult> {
  console.log(`[${requestId}] [runDrugRag] MFDS_DRUG_INFO_API_KEY Exist:`, !!process.env.MFDS_DRUG_INFO_API_KEY)

  const apiKey = process.env.MFDS_DRUG_INFO_API_KEY?.trim()
  if (!apiKey) {
    console.warn(`⚠️ [${requestId}] MFDS_DRUG_INFO_API_KEY 미설정 — 약물 RAG 생략`)
    return { drugContext: null, apiUsed: false, itemCount: 0 }
  }

  try {
    console.log(`🌐 [${requestId}] MFDS getDrugPrdtMcpnDtlInq07 호출: "${drugQuery}"`)
    const { items, totalCount } = await fetchDrugPrdtMcpnDtlInq07(apiKey, drugQuery, {
      pageNo: 1,
      numOfRows: 10,
    })
    console.log(`💊 [${requestId}] MFDS API 반환: ${items.length}건 (totalCount: ${totalCount})`)

    if (items.length === 0) {
      return { drugContext: null, apiUsed: true, itemCount: 0 }
    }

    const drugContext = formatDrugContextForPrompt(items)
    return { drugContext, apiUsed: true, itemCount: items.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`❌ [${requestId}] MFDS API 호출 실패:`, msg)
    return { drugContext: null, apiUsed: false, itemCount: 0 }
  }
}
