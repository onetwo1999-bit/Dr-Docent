import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAgeFromBirthDate } from '@/utils/health'

export const dynamic = 'force-dynamic'

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return '저체중'
  if (bmi < 23) return '정상'
  if (bmi < 25) return '과체중'
  if (bmi < 30) return '비만 1단계'
  return '비만 2단계'
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body?.visit_purpose?.trim()) {
      return NextResponse.json({ error: '방문 목적을 입력해주세요' }, { status: 400 })
    }
    const visit_purpose: string = body.visit_purpose.trim()

    // 1. 프로필 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('birth_date, gender, height, weight, conditions, chronic_diseases, medications, bmi')
      .eq('id', user.id)
      .single()

    // 2. 최근 30일 health_logs 조회
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: healthLogs } = await supabase
      .from('health_logs')
      .select('category, logged_at, notes, meal_description, exercise_type, duration_minutes, medication_name, sleep_duration_hours')
      .eq('user_id', user.id)
      .gte('logged_at', thirtyDaysAgo.toISOString())
      .order('logged_at', { ascending: false })
      .limit(100)

    // 3. 복용 약물 (user_medications 있으면 사용, 없으면 profiles.medications 사용)
    let medicationsList = profile?.medications?.trim() || '없음'
    const { data: userMeds } = await supabase
      .from('user_medications')
      .select('medication_name, dosage, frequency')
      .eq('user_id', user.id)
    if (userMeds && userMeds.length > 0) {
      medicationsList = userMeds
        .map(m => `${m.medication_name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`)
        .join('\n- ')
    }

    // 4. 건강 기록 요약
    const logs = healthLogs || []
    const mealLogs = logs.filter(l => l.category === 'meal')
    const exerciseLogs = logs.filter(l => l.category === 'exercise')
    const medicationLogs = logs.filter(l => l.category === 'medication')
    const sleepLogs = logs.filter(l => l.category === 'sleep')

    const sleepDurations = sleepLogs
      .map(l => l.sleep_duration_hours)
      .filter((h): h is number => typeof h === 'number' && !Number.isNaN(h))
    const avgSleep = sleepDurations.length > 0
      ? (sleepDurations.reduce((a, b) => a + b, 0) / sleepDurations.length).toFixed(1)
      : null

    const recentMeals = mealLogs.slice(0, 5)
      .map(l => l.meal_description || l.notes || '식사')
      .filter(Boolean)
      .join(', ')

    const recentExercise = exerciseLogs.slice(0, 5)
      .map(l => l.exercise_type
        ? `${l.exercise_type}${l.duration_minutes ? ` ${l.duration_minutes}분` : ''}`
        : '운동')
      .join(', ')

    // 5. BMI 계산
    let bmiValue = profile?.bmi
    if (!bmiValue && profile?.height && profile?.weight) {
      bmiValue = profile.weight / Math.pow(profile.height / 100, 2)
    }
    const bmiText = bmiValue
      ? `${(bmiValue as number).toFixed(1)} (${getBMICategory(bmiValue as number)})`
      : '측정 불가'

    const age = profile?.birth_date ? getAgeFromBirthDate(profile.birth_date) : null
    const gender = profile?.gender === 'male' ? '남성' : profile?.gender === 'female' ? '여성' : '미입력'
    const diseases = profile?.chronic_diseases || profile?.conditions || '없음'

    // 6. Claude 프롬프트 구성
    const systemPrompt = `당신은 환자의 건강 데이터를 바탕으로 의료 문진표를 작성하는 전문 시스템입니다.
반드시 아래 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

{
  "general": {
    "sections": [
      { "title": "기본 정보", "content": "문자열" },
      { "title": "최근 생활 습관", "content": "문자열" },
      { "title": "복용 중인 약·영양제", "content": "문자열" },
      { "title": "특이사항", "content": "문자열" }
    ]
  },
  "medical": {
    "sections": [
      { "title": "Chief Complaint", "content": "문자열" },
      { "title": "Medical History", "content": "문자열" },
      { "title": "Current Medications", "content": "문자열" },
      { "title": "Vital Signs / BMI", "content": "문자열" },
      { "title": "Recent Activity Log", "content": "문자열" },
      { "title": "Review of Systems", "content": "문자열" }
    ]
  }
}

작성 지침:
- general(일반인용): 누구나 이해할 수 있는 쉬운 한국어, 친근하고 따뜻한 문체
- medical(의료진용): 영문 항목명, 내용은 한국어, 의학 용어 사용, 간결하고 전문적인 문체
- 각 섹션 content는 줄바꿈(\\n)으로 항목 구분
- 데이터가 없는 항목은 "기록 없음" 또는 "미입력"으로 표기`

    const userPrompt = `다음 환자 정보로 문진표를 작성해주세요.

방문 목적: ${visit_purpose}

[환자 기본 정보]
- 나이: ${age != null ? `${age}세` : '미입력'}
- 성별: ${gender}
- 키: ${profile?.height ? `${profile.height}cm` : '미입력'}
- 몸무게: ${profile?.weight ? `${profile.weight}kg` : '미입력'}
- BMI: ${bmiText}
- 기저 질환: ${diseases}

[복용 중인 약물/영양제]
- ${medicationsList}

[최근 30일 건강 기록 요약]
- 식사 기록: ${mealLogs.length}건${recentMeals ? ` (최근 식단: ${recentMeals})` : ''}
- 운동 기록: ${exerciseLogs.length}건${recentExercise ? ` (최근 운동: ${recentExercise})` : ''}
- 복약 기록: ${medicationLogs.length}건
- 수면 기록: ${sleepLogs.length}건${avgSleep ? `, 평균 ${avgSleep}시간` : ''}`

    // 7. Claude API 호출
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다' }, { status: 500 })
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('[Questionnaire] Claude API 오류:', claudeRes.status, errText.slice(0, 300))
      return NextResponse.json({ error: 'AI 문진표 생성 실패' }, { status: 502 })
    }

    const claudeData = await claudeRes.json()
    const rawContent: string = claudeData?.content?.[0]?.text?.trim() ?? ''

    // 8. JSON 파싱 (```json ... ``` 등 감싸진 경우 처리)
    let summaryJson: {
      general: { sections: Array<{ title: string; content: string }> }
      medical: { sections: Array<{ title: string; content: string }> }
    }
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
      summaryJson = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawContent)
    } catch {
      console.error('[Questionnaire] JSON 파싱 실패:', rawContent.slice(0, 300))
      return NextResponse.json({ error: 'AI 응답 파싱 실패. 다시 시도해주세요.' }, { status: 502 })
    }

    // 9. medical_questionnaires 저장
    const { data: saved, error: saveError } = await supabase
      .from('medical_questionnaires')
      .insert({
        user_id: user.id,
        visit_purpose,
        content: rawContent,
        summary_json: summaryJson,
      })
      .select('id, created_at')
      .single()

    if (saveError) {
      console.error('[Questionnaire] DB 저장 실패:', saveError.message)
    }

    return NextResponse.json({
      id: saved?.id,
      visit_purpose,
      summary_json: summaryJson,
      created_at: saved?.created_at ?? new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Questionnaire] 예외:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
