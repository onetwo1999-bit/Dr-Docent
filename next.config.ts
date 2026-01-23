/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              // 기본 정책
              "default-src 'self'",
              
              // 🔗 connect-src: API 및 WebSocket 통신 허용
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.kakao.com https://kapi.kakao.com",
              
              // 📜 script-src: 스크립트 실행 허용 (eval 포함)
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.supabase.co https://*.kakao.com",
              
              // 🖼️ img-src: 이미지 로드 허용
              "img-src 'self' data: blob: https://*.kakao.co.kr https://*.kakaocdn.net https://*.supabase.co",
              
              // 🪟 frame-src: iframe 허용 (OAuth)
              "frame-src 'self' https://*.supabase.co https://*.kakao.com",
              
              // 🎨 style-src: 스타일 허용
              "style-src 'self' 'unsafe-inline'",
              
              // 🔤 font-src: 폰트 허용
              "font-src 'self' data:",
              
              // 🔧 worker-src: 웹 워커 허용 (Supabase Realtime)
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
