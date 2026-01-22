import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next') ?? '/'

  // OAuth 에러 체크 (사용자가 로그인 취소 등)
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || '')}`, requestUrl.origin)
    )
  }

  if (code) {
    const supabase = await createClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Exchange code error:', exchangeError.message)
      return NextResponse.redirect(
        new URL(`/auth/error?error=exchange_failed&message=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
      )
    }

    if (data.session) {
      console.log('Login successful, redirecting to:', next)
      // 성공 시 지정된 경로 또는 루트('/')로 리다이렉트
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // code가 없는 경우
  console.error('No code provided in callback')
  return NextResponse.redirect(
    new URL('/auth/error?error=no_code&message=인증 코드가 없습니다', requestUrl.origin)
  )
}
