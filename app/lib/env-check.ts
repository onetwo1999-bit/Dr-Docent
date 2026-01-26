/**
 * 🔍 환경 변수 런타임 체크 유틸리티
 * 프로덕션에서 필수 환경 변수가 누락되었는지 확인
 */

export function checkRequiredEnvVars() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  const missing: string[] = []

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    console.error('❌ 필수 환경 변수가 누락되었습니다:', missing.join(', '))
    console.error('   Vercel 대시보드에서 환경 변수를 설정해주세요.')
  }

  return missing.length === 0
}

export function getAppUrl(): string {
  // 프로덕션 도메인
  if (typeof window !== 'undefined') {
    // 마지막 슬래시 제거
    return window.location.origin.replace(/\/$/, '')
  }
  
  // 서버 사이드 - 마지막 슬래시 제거
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dr-docent.vercel.app'
  return appUrl.replace(/\/$/, '')
}

export function normalizeUrl(url: string): string {
  // URL 정규화: 마지막 슬래시 제거, 프로토콜 확인
  let normalized = url.trim()
  
  // 마지막 슬래시 제거
  normalized = normalized.replace(/\/$/, '')
  
  // 프로토콜이 없으면 https 추가
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`
  }
  
  return normalized
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function getVapidPublicKey(): string {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key && isProduction()) {
    console.warn('⚠️ VAPID 공개 키가 설정되지 않았습니다. 푸시 알림이 작동하지 않을 수 있습니다.')
  }
  return key || ''
}
