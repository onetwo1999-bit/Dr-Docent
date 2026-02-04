import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 📅 Schedules API
// 반복 일정 관리
// ========================

type CategoryType = 'meal' | 'exercise' | 'medication' | 'cycle'
type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'once'

interface Schedule {
  id?: string
  category: CategoryType
  sub_type?: string
  title: string
  description?: string
  frequency: FrequencyType
  scheduled_time: string
  days_of_week: number[]
  day_of_month?: number
  is_active: boolean
  notification_enabled: boolean
}

// Supabase 클라이언트 생성
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

// ========================
// GET: 스케줄 조회
// ========================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 쿼리 빌더
    let query = supabase
      .from('schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('scheduled_time', { ascending: true })

    // 카테고리 필터
    if (category && ['meal', 'exercise', 'medication', 'cycle'].includes(category)) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ [Schedules] 조회 에러:', error)
      
      // 테이블 없음 에러
      if (error.code === '42P01') {
        return NextResponse.json({
          success: false,
          error: 'schedules 테이블이 존재하지 않습니다.',
          hint: 'supabase/schema-v2.sql 파일을 실행해주세요.',
          data: []
        })
      }
      
      // 42703: column does not exist (scheduled_time, day_of_month 등)
      const errMsg = (error as { message?: string }).message || ''
      if (error.code === '42703' || errMsg.includes('does not exist')) {
        const needPatch = errMsg.includes('scheduled_time') || errMsg.includes('day_of_month')
        return NextResponse.json({
          success: false,
          error: 'schedules 테이블에 필요한 컬럼이 없습니다.',
          details: errMsg,
          hint: needPatch
            ? 'Supabase SQL Editor에서 supabase/schedules-add-scheduled-time-and-day-of-month.sql 을 실행한 뒤, Settings → API → "Reload schema"를 클릭해주세요.'
            : 'Supabase SQL Editor에서 supabase/schedules-ensure-table-and-columns.sql 을 실행한 뒤, Settings → API → "Reload schema"를 클릭해주세요.',
          data: []
        })
      }
      
      // PGRST205 / PGRST204: 스키마 캐시에 테이블 또는 컬럼 없음
      if (error.code === 'PGRST205' || error.code === 'PGRST204') {
        const errMsg204 = (error as { message?: string }).message || ''
        const needPatch = errMsg204.includes('scheduled_time') || errMsg204.includes('day_of_month')
        return NextResponse.json({
          success: false,
          error: 'schedules 테이블 또는 컬럼을 API에서 찾을 수 없습니다.',
          details: errMsg204,
          hint: needPatch
            ? 'Supabase SQL Editor에서 supabase/schedules-add-scheduled-time-and-day-of-month.sql 을 실행한 뒤 Settings → API → "Reload schema"를 클릭해주세요.'
            : 'Supabase SQL Editor에서 supabase/schedules-ensure-table-and-columns.sql 을 실행한 뒤 Settings → API → "Reload schema"를 클릭해주세요.',
          data: []
        })
      }
      
      return NextResponse.json(
        { success: false, error: '스케줄 조회 중 오류가 발생했습니다.', data: [] },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: data?.length || 0
    })

  } catch (error) {
    console.error('❌ [Schedules] 서버 에러:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.', data: [] },
      { status: 500 }
    )
  }
}

// ========================
// POST: 스케줄 저장 (일괄 upsert)
// ========================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { schedules } = body as { schedules: Schedule[] }

    if (!schedules || !Array.isArray(schedules)) {
      return NextResponse.json(
        { error: '유효하지 않은 데이터입니다.' },
        { status: 400 }
      )
    }

    // category 필드 보강: 누락 시 기본값 'meal', 유효하지 않은 값도 'meal'로 정규화 (PGRST204/42703 방지)
    const validCategories: CategoryType[] = ['meal', 'exercise', 'medication', 'cycle']
    const normalizeCategory = (c: unknown): CategoryType =>
      (typeof c === 'string' && validCategories.includes(c as CategoryType)) ? (c as CategoryType) : 'meal'
    const normalizedSchedules = schedules.map(s => ({
      ...s,
      category: normalizeCategory(s.category)
    }))

    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    console.log('📅 [Schedules] 저장 시도:', normalizedSchedules.length, '개')

    // 기존 스케줄 삭제 (해당 카테고리만)
    const categories = [...new Set(normalizedSchedules.map(s => s.category))]
    for (const category of categories) {
      await supabase
        .from('schedules')
        .delete()
        .eq('user_id', user.id)
        .eq('category', category)
    }

    // 새 스케줄 삽입 (category 필수 포함)
    // DB에 'time' 컬럼이 있는 경우 대비: time NOT NULL 위반(23502) 방지를 위해 time 값도 전달
    const defaultTime = '09:00'
    const schedulesToInsert = normalizedSchedules.map(s => {
      const timeValue = (s.scheduled_time && String(s.scheduled_time).trim()) || defaultTime
      return {
        user_id: user.id,
        category: s.category,
        sub_type: s.sub_type || null,
        title: s.title,
        description: s.description || null,
        frequency: s.frequency,
        scheduled_time: timeValue,
        time: timeValue, // DB 컬럼명이 'time'인 경우 23502 not_null_violation 방지
        days_of_week: s.days_of_week,
        day_of_month: s.day_of_month || null,
        is_active: s.is_active,
        notification_enabled: s.notification_enabled
      }
    })

    const { data, error } = await supabase
      .from('schedules')
      .insert(schedulesToInsert)
      .select()

    if (error) {
      console.error('❌ [Schedules] 저장 에러:', error)
      
      // 23502: not_null_violation (time 또는 scheduled_time에 null 전달된 경우)
      if (error.code === '23502' || (error as { message?: string }).message?.includes('not-null constraint')) {
        const msg = (error as { message?: string }).message || ''
        return NextResponse.json({
          success: false,
          error: '알림 시간 값이 누락되었습니다.',
          details: msg,
          hint: "DB에 'time' 컬럼이 있으면 API가 이제 해당 값도 전달합니다. 배포 후 다시 시도하거나, Supabase에서 supabase/schedules-sync-time-column.sql 실행 후 Reload schema 해주세요."
        }, { status: 500 })
      }
      
      // 테이블 없음 에러
      if (error.code === '42P01') {
        return NextResponse.json({
          success: false,
          error: 'schedules 테이블이 존재하지 않습니다.',
          hint: 'supabase/schema-v2.sql 파일을 실행해주세요.'
        }, { status: 500 })
      }
      
      // 42703: column does not exist (scheduled_time, day_of_month 등)
      const postErrMsg = (error as { message?: string }).message || ''
      if (error.code === '42703' || postErrMsg.includes('does not exist')) {
        const needPatch = postErrMsg.includes('scheduled_time') || postErrMsg.includes('day_of_month')
        return NextResponse.json({
          success: false,
          error: 'schedules 테이블에 필요한 컬럼이 없습니다.',
          details: postErrMsg,
          hint: needPatch
            ? 'Supabase SQL Editor에서 supabase/schedules-add-scheduled-time-and-day-of-month.sql 을 실행한 뒤 Settings → API → "Reload schema"를 클릭해주세요.'
            : 'Supabase SQL Editor에서 supabase/schedules-ensure-table-and-columns.sql 을 실행한 뒤 Settings → API → "Reload schema"를 클릭해주세요.'
        }, { status: 500 })
      }
      
      // PGRST205 / PGRST204: 스키마 캐시
      if (error.code === 'PGRST205' || error.code === 'PGRST204') {
        const postErrMsg204 = (error as { message?: string }).message || ''
        const needPatch = postErrMsg204.includes('scheduled_time') || postErrMsg204.includes('day_of_month')
        return NextResponse.json({
          success: false,
          error: 'schedules 테이블/컬럼을 API에서 찾을 수 없습니다.',
          details: postErrMsg204,
          hint: needPatch
            ? 'Supabase SQL Editor에서 supabase/schedules-add-scheduled-time-and-day-of-month.sql 을 실행한 뒤 Settings → API → "Reload schema"를 클릭해주세요.'
            : 'supabase/schedules-ensure-table-and-columns.sql 실행 후 Settings → API → "Reload schema" 클릭해주세요.'
        }, { status: 500 })
      }
      
      // RLS 에러
      if (error.code === '42501') {
        return NextResponse.json({
          success: false,
          error: 'RLS 정책 오류가 발생했습니다.',
          hint: 'Supabase에서 schedules 테이블의 RLS 정책을 확인해주세요.'
        }, { status: 403 })
      }
      
      return NextResponse.json(
        { success: false, error: '스케줄 저장 중 오류가 발생했습니다.', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ [Schedules] 저장 완료:', data?.length, '개')

    revalidatePath('/dashboard')
    revalidatePath('/')

    return NextResponse.json({
      success: true,
      message: '스케줄이 저장되었습니다.',
      data
    })

  } catch (error) {
    console.error('❌ [Schedules] 서버 에러:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// ========================
// DELETE: 스케줄 삭제
// ========================
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const scheduleId = searchParams.get('id')

    if (!scheduleId) {
      return NextResponse.json(
        { error: '삭제할 스케줄 ID가 필요합니다.' },
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

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', scheduleId)
      .eq('user_id', user.id)

    if (error) {
      console.error('❌ [Schedules] 삭제 에러:', error)
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({
          success: false,
          error: 'schedules 테이블을 찾을 수 없습니다.',
          hint: 'Supabase에서 schema-v2.sql 실행 후 "Reload schema" 해주세요.'
        }, { status: 500 })
      }
      return NextResponse.json(
        { success: false, error: '스케줄 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '스케줄이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('❌ [Schedules] 서버 에러:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
