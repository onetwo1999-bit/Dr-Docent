/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // 🚨 'unsafe-eval'을 넣어줘야 브라우저가 수파베이스 로그인을 허용합니다.
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline' *.supabase.co *.kakao.com;",
          },
        ],
      },
    ]
  },
}
export default nextConfig