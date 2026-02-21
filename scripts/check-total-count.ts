/**
 * 의약품 개요정보(DrbEasyDrugInfoService) API 호출 → 응답 JSON 전체 구조 출력
 * - itemName='가', numOfRows=1 로 호출
 * - 성공(200) 시 totalCount 추출 없이 응답 JSON 전체를 터미널에 출력
 * - 인증키 그대로 실패 시 decodeURIComponent 적용 버전으로 재시도
 *
 * 실행: node --import tsx scripts/check-total-count.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })

const BASE = 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList'

function buildUrl(serviceKey: string): string {
  const params = new URLSearchParams({
    serviceKey,
    pageNo: '1',
    numOfRows: '1',
    itemName: '가',
    type: 'json',
  })
  return `${BASE}?${params.toString()}`
}

async function callApi(serviceKey: string): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
  const url = buildUrl(serviceKey)
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = { _raw: text.slice(0, 500), _parseError: true }
  }
  return { ok: res.ok, status: res.status, data, text }
}

async function main() {
  const rawKey = process.env.MFDS_SERVICE_KEY?.trim()
  if (!rawKey) {
    console.error('❌ .env.local에 MFDS_SERVICE_KEY가 없습니다.')
    process.exit(1)
  }
  console.log('[확인] MFDS_SERVICE_KEY 로드됨 (' + rawKey.length + '자)\n')

  let result: { ok: boolean; status: number; data: unknown; text: string }

  result = await callApi(rawKey)
  if (!result.ok) {
    console.log('[1차] serviceKey 그대로 사용 → HTTP', result.status)
    console.log('[1차] 에러 발생 → decodeURIComponent(키) 버전으로 재시도\n')
    let decodedKey: string
    try {
      decodedKey = decodeURIComponent(rawKey)
    } catch {
      decodedKey = rawKey
    }
    result = await callApi(decodedKey)
    if (!result.ok) {
      console.log('[2차] decodeURIComponent(키) 사용 → HTTP', result.status)
      console.error('❌ 두 방식 모두 실패. 응답 일부:', result.text.slice(0, 400))
      process.exit(1)
    }
    console.log('[2차] decodeURIComponent(키) 사용 → HTTP 200 성공\n')
  } else {
    console.log('[1차] serviceKey 그대로 사용 → HTTP 200 성공\n')
  }

  console.log('═══════════════════════════════════════')
  console.log('  DrbEasyDrugInfoService 응답 JSON 전체')
  console.log('  (itemName=가, numOfRows=1)')
  console.log('═══════════════════════════════════════\n')
  console.log(JSON.stringify(result.data, null, 2))
  console.log('\n═══════════════════════════════════════')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
