/**
 * 🔍 Service Worker 검증 스크립트
 * sw.js 파일이 프로덕션 배포에 적합한지 확인
 */

const fs = require('fs')
const path = require('path')

const swPath = path.join(__dirname, '../public/sw.js')
const swContent = fs.readFileSync(swPath, 'utf-8')

console.log('\n🔍 Service Worker 검증 시작...\n')
console.log('='.repeat(60))

let hasErrors = false
let hasWarnings = false

// 1. 하드코딩된 도메인 체크
const hardcodedDomains = [
  'localhost',
  '127.0.0.1',
  'test',
  'staging',
  'vercel.app'
]

for (const domain of hardcodedDomains) {
  // URL 패턴으로 체크 (하드코딩된 전체 URL이 아닌지)
  const urlPattern = new RegExp(`https?://[^/]*${domain}[^/]*`, 'gi')
  const matches = swContent.match(urlPattern)
  if (matches) {
    console.warn(`⚠️  하드코딩된 도메인 발견: ${matches.join(', ')}`)
    hasWarnings = true
  }
}

// 2. 상대 경로 사용 확인
const relativePathPattern = /['"](\.\/|\/)[^'"]*['"]/g
const relativePaths = swContent.match(relativePathPattern)
if (relativePaths && relativePaths.length > 0) {
  console.log(`✅ 상대 경로 사용 확인: ${relativePaths.length}개`)
} else {
  console.warn('⚠️  상대 경로가 충분하지 않을 수 있습니다')
  hasWarnings = true
}

// 3. 캐시 버전 확인
const cacheVersionMatch = swContent.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/)
if (cacheVersionMatch) {
  console.log(`✅ 캐시 버전: ${cacheVersionMatch[1]}`)
} else {
  console.error('❌ 캐시 버전을 찾을 수 없습니다')
  hasErrors = true
}

// 4. skipWaiting 확인
if (swContent.includes('skipWaiting')) {
  console.log('✅ skipWaiting() 사용 확인됨')
} else {
  console.warn('⚠️  skipWaiting()이 없습니다. 캐시 갱신이 지연될 수 있습니다')
  hasWarnings = true
}

// 5. fetch 이벤트 리다이렉트 처리 확인
if (swContent.includes("redirect: 'follow'")) {
  console.log('✅ 리다이렉트 처리 확인됨')
} else {
  console.warn('⚠️  리다이렉트 처리가 없을 수 있습니다')
  hasWarnings = true
}

// 6. API 요청 제외 확인
if (swContent.includes("/api/") && swContent.includes('return')) {
  console.log('✅ API 요청 제외 처리 확인됨')
} else {
  console.warn('⚠️  API 요청 제외 처리를 확인할 수 없습니다')
  hasWarnings = true
}

console.log('\n' + '='.repeat(60))

if (hasErrors) {
  console.error('\n❌ Service Worker에 문제가 있습니다. 수정이 필요합니다.\n')
  process.exit(1)
}

if (hasWarnings) {
  console.warn('\n⚠️  일부 권장 사항을 확인해주세요.\n')
} else {
  console.log('\n✅ Service Worker가 프로덕션 배포에 적합합니다!\n')
}

process.exit(0)
