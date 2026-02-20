/**
 * 실시간 API 호출 및 지능형 캐싱 — 의약품 검색 서비스
 *
 * Fallback: DB(drug_master) 조회 결과가 없거나 효능(ee_doc_data)이 비어 있으면
 * 즉시 e-약은요 API(getDrugPrdtMcpnDtlInq07) 호출 후 시스템 프롬프트에 주입.
 *
 * 저장 정책(성능 우선):
 * - API 호출이 발생할 때마다 해당 결과를 drug_master에 upsert → 다음 검색 시 DB 히트, API 호출 감소.
 * - paper_insight(안심 행동 지침)는 5회 이상 검색된 약물만 업데이트 → 저장 비용·품질 절충.
 */

export {
  runDrugRag,
  saveDrugResultAfterResponse,
  formatDrugContextForPrompt,
  type DrugRagResult,
} from './drug-rag'
export type { MfdsMcpn07Item } from './mfds-drug-mcpn07'
