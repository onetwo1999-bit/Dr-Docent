/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // 🚨 'unsafe-eval'을 추가하여 라이브러리 실행을 허용합니다.
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline' *.supabase.co *.kakao.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;