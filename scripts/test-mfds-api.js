/**
 * 식약처 API 통신 테스트: 검색 필터(Prduct 등) 없이 serviceKey만으로 호출
 * - URL: ...?serviceKey=내_인증키&pageNo=1&numOfRows=10&type=json
 * - 기대: totalCount 128,654 등 정상 응답. 0건이면 serviceKey 인코딩 방식 시도
 *
 * 실행: node scripts/test-mfds-api.js
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })

const BASE =
  'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtMcpnDtlInq07'

function maskKey(key) {
  if (!key || key.length < 4) return '****'
  return key.slice(0, 4) + '...'
}

async function callWithoutFilter(apiKey, useEncodedKey = false) {
  const keyForUrl = useEncodedKey ? encodeURIComponent(apiKey) : apiKey
  const url = `${BASE}?serviceKey=${keyForUrl}&pageNo=1&numOfRows=10&type=json`
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, totalCount: null, error: `JSON 파싱 실패: ${text.slice(0, 200)}`, url }
  }
  const header = data?.response?.header ?? data?.header
  const body = data?.response?.body ?? data?.body
  const resultCode = header?.resultCode ?? data?.resultCode
  const resultMsg = header?.resultMsg ?? data?.resultMsg ?? ''
  const totalCount = body?.totalCount != null
    ? Number(body?.totalCount)
    : (data?.totalCount != null ? Number(data.totalCount) : null)
  const items = body?.items ?? data?.items
  const itemCount = Array.isArray(items) ? items.length : (items ? 1 : 0)
  return {
    ok: res.ok && (resultCode === '00' || resultCode === undefined),
    totalCount,
    resultCode,
    resultMsg,
    itemCount,
    url,
    raw: data,
  }
}

async function main() {
  const apiKey = process.env.MFDS_SERVICE_KEY?.trim()
  if (!apiKey) {
    console.error('❌ .env.local에 MFDS_SERVICE_KEY(e-약은요)가 없습니다.')
    process.exit(1)
  }

  console.log('🔌 식약처 API 통신 테스트 (검색 조건 없음: Prduct 미사용)\n')
  const testUrl = `${BASE}?serviceKey=${maskKey(apiKey)}&pageNo=1&numOfRows=10&type=json`
  console.log('테스트 URL (인증키 앞 4자만 노출):')
  console.log(testUrl)
  console.log('')

  // 1) 인증키 그대로 전달
  console.log('1) serviceKey 그대로 전달 (인코딩 없음)...')
  let result = await callWithoutFilter(apiKey, false)
  console.log(`   totalCount: ${result.totalCount ?? '없음'}, resultCode: ${result.resultCode ?? '없음'}, items: ${result.itemCount}건`)
  if (result.resultMsg) console.log(`   resultMsg: ${result.resultMsg}`)

  if (result.totalCount !== null && result.totalCount > 0) {
    console.log('\n✅ 통로 정상. totalCount =', result.totalCount)
    if (result.totalCount === 128654) console.log('   (기대값 128,654와 일치)')
    return
  }

  // 2) 0건이면 serviceKey를 encodeURIComponent로 전달 후 재시도
  console.log('\n2) totalCount가 0이거나 없음 → serviceKey를 encodeURIComponent로 넣어 재시도...')
  result = await callWithoutFilter(apiKey, true)
  console.log(`   totalCount: ${result.totalCount ?? '없음'}, resultCode: ${result.resultCode ?? '없음'}, items: ${result.itemCount}건`)
  if (result.resultMsg) console.log(`   resultMsg: ${result.resultMsg}`)

  if (result.totalCount !== null && result.totalCount > 0) {
    console.log('\n✅ 인코딩 키로 통과. totalCount =', result.totalCount)
    console.log('   → 앱/스크립트에서 serviceKey를 encodeURIComponent(키)로 넘기면 됩니다.')
    return
  }

  console.log('\n❌ 두 방식 모두 데이터 0건. 원인 가능성:')
  console.log('   - serviceKey가 잘못되었거나 만료됨')
  console.log('   - 해당 API가 검색 조건(Prduct 등) 필수일 수 있음')
  console.log('   - 공공데이터포털에서 서비스 URL/오퍼레이션 확인')
  const rawStr = JSON.stringify(result.raw ?? {}, null, 2)
  console.log('   응답 원문 (일부):', rawStr.slice(0, 800) + (rawStr.length > 800 ? '...' : ''))
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
