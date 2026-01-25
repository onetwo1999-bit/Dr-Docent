import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * 🧪 Health Logs 테스트 API
 * 
 * 이 엔드포인트는 health_logs 테이블 연결 및 데이터 저장을 테스트합니다.
 * 
 * 사용법:
 * GET /api/health-logs/test
 * 
 * 반환값:
 * - 테스트 결과 요약
 * - 저장된 데이터 확인
 * - 에러 발생 시 상세 정보
 */

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

export async function GET(req: Request) {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [] as Array<{ name: string; status: 'pass' | 'fail'; message: string; details?: any }>,
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  }

  try {
    const supabase = await createClient()
    
    // 테스트 1: 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      results.tests.push({
        name: '인증 확인',
        status: 'fail',
        message: '로그인이 필요합니다.',
        details: authError
      })
      results.summary.total++
      results.summary.failed++
      return NextResponse.json(results, { status: 401 })
    }

    results.tests.push({
      name: '인증 확인',
      status: 'pass',
      message: `사용자 인증 성공: ${user.email || user.id}`,
      details: { user_id: user.id, email: user.email }
    })
    results.summary.total++
    results.summary.passed++

    // 테스트 2: 테이블 존재 확인
    const { data: tableCheck, error: tableError } = await supabase
      .from('health_logs')
      .select('id')
      .limit(1)

    if (tableError) {
      if (tableError.code === '42P01') {
        results.tests.push({
          name: '테이블 존재 확인',
          status: 'fail',
          message: 'health_logs 테이블이 존재하지 않습니다.',
          details: {
            error: tableError.message,
            hint: 'supabase/schema-v2.sql 파일을 Supabase SQL Editor에서 실행해주세요.'
          }
        })
      } else {
        results.tests.push({
          name: '테이블 존재 확인',
          status: 'fail',
          message: '테이블 조회 중 오류 발생',
          details: tableError
        })
      }
      results.summary.total++
      results.summary.failed++
    } else {
      results.tests.push({
        name: '테이블 존재 확인',
        status: 'pass',
        message: 'health_logs 테이블이 정상적으로 존재합니다.',
        details: { table_exists: true }
      })
      results.summary.total++
      results.summary.passed++
    }

    // 테스트 3: 데이터 삽입 테스트 (식사)
    const testMealData = {
      user_id: user.id,
      category: 'meal' as const,
      logged_at: new Date().toISOString(),
      note: '테스트 기록 (식사)'
    }

    const { data: insertedMeal, error: insertMealError } = await supabase
      .from('health_logs')
      .insert(testMealData)
      .select()
      .single()

    if (insertMealError) {
      results.tests.push({
        name: '식사 기록 삽입',
        status: 'fail',
        message: '식사 기록 저장 실패',
        details: {
          error: insertMealError.message,
          code: insertMealError.code,
          hint: insertMealError.code === '42501' 
            ? 'RLS 정책 오류: Supabase에서 RLS 정책을 확인해주세요.'
            : '데이터 삽입 권한 또는 테이블 구조를 확인해주세요.'
        }
      })
      results.summary.total++
      results.summary.failed++
    } else {
      results.tests.push({
        name: '식사 기록 삽입',
        status: 'pass',
        message: '식사 기록이 성공적으로 저장되었습니다.',
        details: { inserted_id: insertedMeal.id, logged_at: insertedMeal.logged_at }
      })
      results.summary.total++
      results.summary.passed++

      // 테스트 데이터 삭제
      await supabase.from('health_logs').delete().eq('id', insertedMeal.id)
    }

    // 테스트 4: 데이터 삽입 테스트 (운동)
    const testExerciseData = {
      user_id: user.id,
      category: 'exercise' as const,
      logged_at: new Date().toISOString(),
      note: '테스트 기록 (운동)'
    }

    const { data: insertedExercise, error: insertExerciseError } = await supabase
      .from('health_logs')
      .insert(testExerciseData)
      .select()
      .single()

    if (insertExerciseError) {
      results.tests.push({
        name: '운동 기록 삽입',
        status: 'fail',
        message: '운동 기록 저장 실패',
        details: insertExerciseError
      })
      results.summary.total++
      results.summary.failed++
    } else {
      results.tests.push({
        name: '운동 기록 삽입',
        status: 'pass',
        message: '운동 기록이 성공적으로 저장되었습니다.',
        details: { inserted_id: insertedExercise.id }
      })
      results.summary.total++
      results.summary.passed++

      await supabase.from('health_logs').delete().eq('id', insertedExercise.id)
    }

    // 테스트 5: 데이터 삽입 테스트 (복약)
    const testMedicationData = {
      user_id: user.id,
      category: 'medication' as const,
      logged_at: new Date().toISOString(),
      note: '테스트 기록 (복약)'
    }

    const { data: insertedMedication, error: insertMedicationError } = await supabase
      .from('health_logs')
      .insert(testMedicationData)
      .select()
      .single()

    if (insertMedicationError) {
      results.tests.push({
        name: '복약 기록 삽입',
        status: 'fail',
        message: '복약 기록 저장 실패',
        details: insertMedicationError
      })
      results.summary.total++
      results.summary.failed++
    } else {
      results.tests.push({
        name: '복약 기록 삽입',
        status: 'pass',
        message: '복약 기록이 성공적으로 저장되었습니다.',
        details: { inserted_id: insertedMedication.id }
      })
      results.summary.total++
      results.summary.passed++

      await supabase.from('health_logs').delete().eq('id', insertedMedication.id)
    }

    // 테스트 6: 데이터 조회 테스트
    const { data: fetchedLogs, error: fetchError } = await supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(10)

    if (fetchError) {
      results.tests.push({
        name: '데이터 조회',
        status: 'fail',
        message: '기록 조회 실패',
        details: fetchError
      })
      results.summary.total++
      results.summary.failed++
    } else {
      results.tests.push({
        name: '데이터 조회',
        status: 'pass',
        message: `총 ${fetchedLogs?.length || 0}개의 기록을 조회했습니다.`,
        details: { count: fetchedLogs?.length || 0 }
      })
      results.summary.total++
      results.summary.passed++
    }

    // 최종 요약
    const allPassed = results.summary.failed === 0
    results.summary.total = results.tests.length

    return NextResponse.json({
      ...results,
      success: allPassed,
      message: allPassed 
        ? '✅ 모든 테스트가 통과했습니다! health_logs 테이블이 정상적으로 작동합니다.'
        : `⚠️ ${results.summary.failed}개의 테스트가 실패했습니다.`
    }, { status: allPassed ? 200 : 500 })

  } catch (error: any) {
    results.tests.push({
      name: '예외 처리',
      status: 'fail',
      message: '테스트 실행 중 예외 발생',
      details: { error: error.message, stack: error.stack }
    })
    results.summary.total++
    results.summary.failed++

    return NextResponse.json({
      ...results,
      success: false,
      message: '테스트 실행 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
