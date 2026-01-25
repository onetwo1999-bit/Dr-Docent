import type { NextConfig } from 'next'

// 🌐 배포 도메인 설정
const DEPLOY_DOMAIN = 'dr-docent.vercel.app'
const SUPABASE_DOMAIN = 'fddoizheudxxqescjpbq.supabase.co'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              // 기본 정책: 자기 자신만 허용
              "default-src 'self'",
              
              // 스크립트: self + eval(Next.js 개발모드) + inline
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              
              // 스타일: self + inline (Tailwind CSS)
              "style-src 'self' 'unsafe-inline'",
              
              // 이미지: self + Supabase + Google + 배포 도메인
              `img-src 'self' https://${SUPABASE_DOMAIN} https://${DEPLOY_DOMAIN} https://*.googleusercontent.com https://*.google.com data: blob:`,
              
              // 폰트: self + Google Fonts
              "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
              
              // 연결: self + Supabase + 배포 도메인 (Auth/DB/Realtime/API)
              `connect-src 'self' https://${SUPABASE_DOMAIN} wss://${SUPABASE_DOMAIN} https://*.supabase.co https://${DEPLOY_DOMAIN} https://api.anthropic.com https://api.openai.com`,
              
              // 프레임: 없음
              "frame-ancestors 'none'",
              
              // 폼 제출: self + 배포 도메인
              `form-action 'self' https://${DEPLOY_DOMAIN}`,
              
              // 기본 URI
              "base-uri 'self'",
              
              // HTTPS 강제 (프로덕션에서 보안 강화)
              "upgrade-insecure-requests",
            ].join('; ')
          },
          // 추가 보안 헤더들
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // HSTS (HTTPS 강제)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
        ],
      },
    ]
  },
}

export default nextConfig
