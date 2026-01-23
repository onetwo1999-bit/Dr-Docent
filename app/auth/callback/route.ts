import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('🔄 [Callback] 시작')
  console.log('   - code:', code ? '있음' : '없음')
  console.log('   - origin:', origin)

  if (!code) {
    console.error('❌ [Callback] 인증 코드가 없습니다')
    return NextResponse.redirect(`${origin}/?error=no_code`)
  }

  const cookieStore = await cookies()
  
  // 📋 현재 쿠키 상태 로깅
  const allCookies = cookieStore.getAll()
  console.log('📋 [Callback] 현재 쿠키:', allCookies.map(c => c.name).join(', '))

  // 1️⃣ 리다이렉트 응답 객체 생성
  const response = NextResponse.redirect(`${origin}${next}`)

  // 2️⃣ Supabase 클라이언트 생성 - 쿠키를 response에 직접 설정
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies = cookieStore.getAll()
          console.log('📖 [getAll] 쿠키 읽기:', cookies.map(c => c.name).join(', '))
          return cookies
        },
        setAll(cookiesToSet) {
          console.log('✍️ [setAll] 쿠키 설정 시도:', cookiesToSet.map(c => c.name).join(', '))
          
          cookiesToSet.forEach(({ name, value, options }) => {
            // 🔑 응답 객체에 쿠키 직접 설정
            response.cookies.set(name, value, {
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              httpOnly: true,
              maxAge: options?.maxAge ?? 60 * 60 * 24 * 7, // 7일
            })
            console.log(`   ✅ 쿠키 설정됨: ${name}`)
          })
        },
      },
    }
  )

  // 3️⃣ PKCE 흐름: 코드를 세션으로 교환
  console.log('🔐 [Callback] 세션 교환 시작...')
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('❌ [Callback] 세션 교환 실패!')
    console.error('   - 에러 메시지:', error.message)
    console.error('   - 에러 상태:', error.status)
    return NextResponse.redirect(`${origin}/?error=exchange_failed&message=${encodeURIComponent(error.message)}`)
  }

  if (!data.session) {
    console.error('❌ [Callback] 세션 데이터가 없습니다')
    return NextResponse.redirect(`${origin}/?error=no_session`)
  }

  // 4️⃣ 세션 교환 성공!
  console.log('✅ [Callback] 세션 교환 성공!')
  console.log('   - 사용자 ID:', data.session.user.id)
  console.log('   - 이메일:', data.session.user.email)
  console.log('   - Access Token 존재:', !!data.session.access_token)
  console.log('   - Refresh Token 존재:', !!data.session.refresh_token)

  // 5️⃣ 수동으로 세션 쿠키 설정 (보강)
  const sessionData = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.session.expires_in,
    expires_in: data.session.expires_in,
    token_type: 'bearer',
    user: data.session.user,
  }

  // Supabase 세션 쿠키 직접 설정
  const cookieName = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`
  
  response.cookies.set(cookieName, JSON.stringify(sessionData), {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: data.session.expires_in,
  })
  console.log(`✅ [Callback] 세션 쿠키 수동 설정: ${cookieName}`)

  // 6️⃣ code-verifier 쿠키 삭제
  const codeVerifierName = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token-code-verifier`
  response.cookies.set(codeVerifierName, '', {
    path: '/',
    maxAge: 0, // 즉시 만료 = 삭제
  })
  console.log(`🗑️ [Callback] code-verifier 쿠키 삭제: ${codeVerifierName}`)

  // 7️⃣ 최종 응답 쿠키 확인
  console.log('📋 [Callback] 응답에 설정된 쿠키:', 
    response.cookies.getAll().map(c => c.name).join(', ')
  )

  console.log('🎉 [Callback] 완료! 리다이렉트:', `${origin}${next}`)
  return response
}
