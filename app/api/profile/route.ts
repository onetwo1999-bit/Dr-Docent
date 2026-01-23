import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { user_id, age, gender, height, weight, conditions, medications } = body

    if (!user_id) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다' }, { status: 400 })
    }

    const supabase = await createClient()

    // profiles 테이블에 upsert (없으면 생성, 있으면 업데이트)
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user_id,
        age,
        gender,
        height,
        weight,
        conditions,
        medications,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()

    if (error) {
      console.error('❌ 프로필 저장 에러:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ 프로필 저장 완료:', user_id)
    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('❌ 프로필 API 에러:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('❌ 프로필 조회 에러:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile: data || null })

  } catch (error) {
    console.error('❌ 프로필 API 에러:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
