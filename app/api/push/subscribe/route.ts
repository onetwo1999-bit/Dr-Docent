import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 📬 푸시 구독 저장 API
// ========================

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => 
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { endpoint, keys } = body

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: '유효하지 않은 구독 정보입니다.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 기존 구독 확인 및 upsert
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'endpoint'
      })
      .select()

    if (error) {
      console.error('❌ [Push Subscribe] 저장 에러:', error)
      return NextResponse.json(
        { error: '구독 저장 중 오류가 발생했습니다.', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ [Push Subscribe] 구독 저장 완료:', user.email)

    // 기본 알림 설정도 함께 생성
    await supabase
      .from('notification_settings')
      .upsert({
        user_id: user.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    return NextResponse.json({
      success: true,
      message: '푸시 알림 구독이 완료되었습니다.'
    })

  } catch (error) {
    console.error('❌ [Push Subscribe] 서버 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// ========================
// 📬 구독 해제
// ========================
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const endpoint = searchParams.get('endpoint')

    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    let query = supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)

    if (endpoint) {
      query = query.eq('endpoint', endpoint)
    }

    const { error } = await query

    if (error) {
      console.error('❌ [Push Subscribe] 삭제 에러:', error)
      return NextResponse.json(
        { error: '구독 해제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    console.log('✅ [Push Subscribe] 구독 해제 완료:', user.email)

    return NextResponse.json({
      success: true,
      message: '푸시 알림 구독이 해제되었습니다.'
    })

  } catch (error) {
    console.error('❌ [Push Subscribe] 서버 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
