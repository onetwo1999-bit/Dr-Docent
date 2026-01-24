import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Route Handler 전용 Supabase 클라이언트 생성
async function createRouteHandlerClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Route Handler에서 쿠키 설정 실패 시 무시
          }
        },
      },
    }
  )
}

export async function POST(req: Request) {
  console.log('📝 [Profile API] POST 요청 시작')
  
  try {
    // 1. 요청 본문 파싱
    let body
    try {
      body = await req.json()
      console.log('📋 [Profile API] 받은 데이터:', JSON.stringify(body, null, 2))
    } catch (parseError) {
      console.error('❌ [Profile API] JSON 파싱 실패:', parseError)
      return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 400 })
    }

    const { user_id, age, gender, height, weight, conditions, medications } = body

    if (!user_id) {
      console.error('❌ [Profile API] user_id 누락')
      return NextResponse.json({ error: '사용자 ID가 필요합니다' }, { status: 400 })
    }

    // 2. Supabase 클라이언트 생성
    const supabase = await createRouteHandlerClient()

    // 3. 현재 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('❌ [Profile API] 인증 에러:', authError.message)
    }
    
    console.log('👤 [Profile API] 인증된 사용자:', user?.id || '없음')
    console.log('📤 [Profile API] 요청된 user_id:', user_id)

    // 4. 프로필 데이터 준비
    const profileData = {
      id: user_id,
      age: age ? parseInt(age) : null,
      gender: gender || null,
      height: height ? parseFloat(height) : null,
      weight: weight ? parseFloat(weight) : null,
      conditions: conditions || null,
      medications: medications || null,
      updated_at: new Date().toISOString()
    }

    console.log('💾 [Profile API] 저장할 데이터:', JSON.stringify(profileData, null, 2))

    // 5. Upsert 실행 (Service Role Key가 없으면 RLS 적용됨)
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id'
      })
      .select()

    if (error) {
      console.error('❌ [Profile API] Supabase 에러:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      
      // RLS 정책 에러인 경우 안내
      if (error.code === '42501' || error.message.includes('policy')) {
        return NextResponse.json({ 
          error: 'RLS 정책 에러: Supabase 대시보드에서 profiles 테이블의 RLS 정책을 확인하세요.',
          details: error.message 
        }, { status: 403 })
      }
      
      return NextResponse.json({ 
        error: error.message,
        code: error.code 
      }, { status: 500 })
    }

    console.log('✅ [Profile API] 저장 성공:', data)
    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('❌ [Profile API] 예외 발생:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
}

export async function GET(req: Request) {
  console.log('📖 [Profile API] GET 요청 시작')
  
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다' }, { status: 400 })
    }

    const supabase = await createRouteHandlerClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ [Profile API] 조회 에러:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ [Profile API] 조회 성공:', data ? '데이터 있음' : '데이터 없음')
    return NextResponse.json({ profile: data || null })

  } catch (error) {
    console.error('❌ [Profile API] 예외 발생:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
