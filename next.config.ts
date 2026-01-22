/** @type {import('next').NextConfig} */
const nextConfig = {
  // 보안 헤더 설정
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // 🚨 'unsafe-eval'을 추가하여 브라우저 차단을 해제합니다.
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline' *.supabase.co *.kakao.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;