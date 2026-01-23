/** @type {import('next').NextConfig} */
const nextConfig = {
  // CSP 임시 비활성화 - 버튼 클릭 테스트 후 다시 활성화
  // async headers() {
  //   return [
  //     {
  //       source: '/(.*)',
  //       headers: [
  //         {
  //           key: 'Content-Security-Policy',
  //           value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; ..."
  //         },
  //       ],
  //     },
  //   ]
  // },
}

export default nextConfig
