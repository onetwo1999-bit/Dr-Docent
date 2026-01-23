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
              // 기본 정책: 자기 자신만 허용
              "default-src 'self'",
              
              // 🔗 connect-src: API 통신 허용 (로그인, 데이터 요청)
              "connect-src 'self' *.supabase.co *.kakao.com",
              
              // 📜 script-src: 스크립트 실행 허용 (인증 라이브러리)
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' *.supabase.co *.kakao.com",
              
              // 🖼️ img-src: 이미지 로드 허용 (프로필 이미지)
              "img-src 'self' data: blob: *.kakao.co.kr *.kakaocdn.net",
              
              // 🪟 frame-src: iframe 허용 (OAuth 팝업/리다이렉트)
              "frame-src 'self' *.supabase.co",
              
              // 🎨 style-src: 스타일 허용
              "style-src 'self' 'unsafe-inline'",
              
              // 🔤 font-src: 폰트 허용
              "font-src 'self' data:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
