/**
 * 닥터 도슨 채팅 API (표준 OpenAI API 호출 방식)
 *
 * 순차 로직: 유저 질문 → (의학 키워드 시) PubMed 검색 → 프롬프트에 결과 합침 → OpenAI 답변 생성
 * Tool Calling 없이, 코드에서 검색 후 AI에 데이터 전달.
 */
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAgeFromBirthDate, getAgeContextForAI } from '@/utils/health'
import { aggregateHealthContext, formatAggregateForPrompt } from '@/utils/health-aggregator'
import {
  searchRelevantPapers,
  formatPaperContext,
  formatDisclaimer,
  type PaperChunk,
} from '@/lib/medical-papers/rag-search'
import { isAnalysisIntent } from '@/lib/medical-papers/intent'

export const dynamic = 'force-dynamic'

const DAILY_LIMIT = 10
const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'

interface UserProfile {
  birth_date: string | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions: string | null
  medications: string | null
}

function calculateBMI(height: number | null, weight: number | null): { value: number; category: string } | null {
  if (!height || !weight || height <= 0) return null
  const heightM = height / 100
  const bmi = weight / (heightM * heightM)
  const bmiRounded = Math.round(bmi * 10) / 10
  let category = '정상'
  if (bmi < 18.5) category = '저체중'
  else if (bmi < 23) category = '정상'
  else if (bmi < 25) category = '과체중'
  else if (bmi < 30) category = '비만 1단계'
  else category = '비만 2단계'
  return { value: bmiRounded, category }
}

function logHealthProfile(profile: UserProfile | null, userId: string): void {
  console.log('\n' + '='.repeat(50))
  console.log('📊 [건강 데이터 로깅] 사용자:', userId.slice(0, 8) + '...')
  console.log('='.repeat(50))
  if (!profile) {
    console.log('⚠️ 프로필 없음 - 기본 상담 모드')
    return
  }
  const bmi = calculateBMI(profile.height, profile.weight)
  const age = getAgeFromBirthDate(profile.birth_date)
  console.log('👤 나이:', age != null ? `${age}세` : '미입력')
  console.log('⚧️ 성별:', profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '미입력')
  console.log('📏 신장:', profile.height ? `${profile.height}cm` : '미입력')
  console.log('⚖️ 체중:', profile.weight ? `${profile.weight}kg` : '미입력')
  if (bmi) console.log(`📈 BMI: ${bmi.value} (${bmi.category})`)
  if (profile.conditions) console.log('🏥 기저 질환:', profile.conditions)
  else console.log('🏥 기저 질환: 없음')
  if (profile.medications) console.log('💊 복용 약물:', profile.medications)
  else console.log('💊 복용 약물: 없음')
  console.log('='.repeat(50) + '\n')
}

interface AppContextForAPI {
  recentActions?: Array<{ type: string; label: string; detail?: string; path?: string }>
  hesitationHint?: boolean
}

function buildSystemPrompt(
  profile: UserProfile | null,
  currentHealthContext: string | null,
  appContext?: AppContextForAPI | null,
  paperChunks?: PaperChunk[] | null
): string {
  const bmi = profile ? calculateBMI(profile.height, profile.weight) : null

  let systemPrompt = `당신은 20년 경력의 다정하고 전문적인 가정의학과 전문의이자, **사용자의 실시간 대시보드 데이터를 분석하는 전문가**입니다.

## 필수 — 논문 데이터 활용
**논문 데이터를 받으면 절대로 침묵하지 말고, 반드시 그 내용을 요약해서 파트너에게 친절하게 설명해줘.** 검색된 논문만을 근거로 답변하세요. "실시간 접근 불가", "검색 불가" 등의 말은 금지입니다.

## 핵심 지침
- 유저가 **새로운 주제**를 꺼내면 이전 대화에 얽매이지 말고 **새 주제 중심으로만** 답변하세요.
- **절대로 침묵하지 마세요.** 통증·증상 호소 시 "진단이 불가합니다"로 끝내지 말고, 공감 + 일반적 건강 정보 + 진료 요약 방향으로 이끌어 주세요.
- **역할**: 선생님의 최신 건강 기록(수면·운동·식단·복약)을 반영해 분석하고, 데이터상 특이점이 보이면 먼저 언급하세요.
- **톤**: 따뜻하고 공감 능력 있는 의사, '해요체', 유저를 **'선생님'**으로 호칭.
- **답변 구조**: 맨 처음 불릿(•) 3~5개 요약 → 공감 → 데이터 분석 → 생활 처방 → 응원. 전체 800 토큰 이내.
- **금기**: 존스홉킨스 등 특정 병원명 금지. 논문 근거 활용 시 답변 하단에 "본 정보는 검색된 학술 논문을 기반으로 한 참고용이며, 정확한 진단과 치료는 반드시 의료진과 상담하시기 바랍니다." 및 "참고한 논문들은 우측 사이드바에서 자세히 확인하실 수 있습니다" 포함.
`

  if (profile) {
    const age = getAgeFromBirthDate(profile.birth_date)
    const ageContext = getAgeContextForAI(age, profile.birth_date)
    systemPrompt += `\n## 현재 상담 중인 선생님의 건강 프로필\n`
    if (ageContext) systemPrompt += `- ${ageContext}\n`
    if (age != null) systemPrompt += `- 연령: ${age}세\n`
    if (profile.gender) systemPrompt += `- 성별: ${profile.gender === 'male' ? '남성' : '여성'}\n`
    if (profile.height && profile.weight) {
      systemPrompt += `- 신체: ${profile.height}cm / ${profile.weight}kg\n`
      if (bmi) systemPrompt += `- BMI: ${bmi.value} (${bmi.category})\n`
    }
    if (profile.conditions) systemPrompt += `- 기저 질환: ${profile.conditions}\n`
    if (profile.medications) systemPrompt += `- 복용 약물: ${profile.medications}\n`
  } else {
    systemPrompt += `\n## 건강 프로필\n아직 등록된 건강 프로필이 없습니다.\n`
  }

  if (currentHealthContext) {
    systemPrompt += `\n## 최신 건강 상태 요약 (최근 7일)\n\`\`\`\n${currentHealthContext}\n\`\`\`\n`
  }

  if (appContext?.recentActions?.length) {
    const lines = appContext.recentActions.map((a) => `- ${a.label}${a.detail ? ` (${a.detail})` : ''}`)
    systemPrompt += `\n## 앱 내 최근 행동\n${lines.join('\n')}\n\n`
  }

  if (appContext?.hesitationHint) {
    systemPrompt += `\n선생님이 최근 기록 없이 대시보드를 오래 보셨을 수 있습니다. "기록에 어려움이 있으신가요?" 같은 제안을 할 수 있습니다.\n\n`
  }

  if (paperChunks && paperChunks.length > 0) {
    const ctx = formatPaperContext(paperChunks)
    const disclaimer = formatDisclaimer(paperChunks)
    systemPrompt += `\n## 학술 논문 근거 (검색된 논문만 근거로 사용)\n\`\`\`\n${ctx}\n\`\`\`\n`
    systemPrompt += `위 논문 데이터만을 근거로 답변하세요.${disclaimer || ''}\n\n`
  }

  return systemPrompt
}

async function checkDailyLimit(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<{ allowed: boolean; count: number }> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('chat_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()
  if (error && error.code !== 'PGRST116') return { allowed: true, count: 0 }
  return { allowed: (data?.count || 0) < DAILY_LIMIT, count: data?.count || 0 }
}

async function incrementUsage(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  try {
    const { data } = await supabase.from('chat_usage').select('count').eq('user_id', userId).eq('date', today).single()
    if (data) {
      await supabase.from('chat_usage').update({ count: data.count + 1 }).eq('user_id', userId).eq('date', today)
    } else {
      await supabase.from('chat_usage').insert({ user_id: userId, date: today, count: 1 })
    }
  } catch {
    // ignore
  }
}

function logEnvVariables(requestId: string): void {
  const mask = (v: string | undefined, len = 8) => (v && v.length > 0 ? `${v.slice(0, len)}...(${v.length}자)` : '(없음/빈값)')
  console.log(`\n🔧 [${requestId}] .env 로드:`)
  console.log(`   - OPENAI_API_KEY: ${mask(process.env.OPENAI_API_KEY, 15)}`)
  console.log(`   - PUBMED_API_KEY: ${mask(process.env.PUBMED_API_KEY, 10)}`)
  console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'unknown'}`)
}

/** test-api.js와 동일: esearch → esummary (fetch만 사용) */
async function searchPubMedPapers(
  requestId: string,
  query: string,
  retmax: number = 5
): Promise<{ papers: PaperChunk[]; refsForSidebar: { pmid: string; title: string; authors: string; abstract: string }[] }> {
  let apiKey = process.env.PUBMED_API_KEY
  if (apiKey === undefined || apiKey === '') {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
    apiKey = process.env.PUBMED_API_KEY ?? ''
  }
  console.log(`🔬 [${requestId}] 1단계: PubMed esearch 호출 (query: ${query.slice(0, 60)}...)`)
  const refsForSidebar: { pmid: string; title: string; authors: string; abstract: string }[] = []

  if (!apiKey || apiKey.length === 0) {
    console.log(`⚠️ [${requestId}] PUBMED_API_KEY 없음 → RAG fallback`)
    try {
      const chunks = await searchRelevantPapers(query, retmax)
      const papers: PaperChunk[] = chunks.map((c) => ({
        id: c.id,
        pmid: c.pmid,
        title: c.title,
        abstract: c.abstract,
        citation_count: c.citation_count ?? 0,
        tldr: c.tldr,
        chunk_text: c.chunk_text ?? '',
      }))
      refsForSidebar.push(...papers.map((p) => ({ pmid: p.pmid ?? '', title: p.title, authors: '', abstract: p.abstract ?? '' })))
      return { papers, refsForSidebar }
    } catch (err) {
      console.warn(`⚠️ [${requestId}] RAG 검색 실패:`, err)
      return { papers: [], refsForSidebar: [] }
    }
  }

  const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
  const searchUrl = `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&retmode=json&api_key=${apiKey}`

  try {
    const searchRes = await fetch(searchUrl)
    console.log(`🔬 [${requestId}] esearch 응답 상태: ${searchRes.status}`)
    if (!searchRes.ok) throw new Error(`PubMed esearch failed: ${searchRes.status}`)
    const searchData = await searchRes.json()
    const idlist: string[] = searchData?.esearchresult?.idlist ?? []
    if (!Array.isArray(idlist) || idlist.length === 0) {
      console.log(`📭 [${requestId}] PubMed 검색 결과 0건`)
      return { papers: [], refsForSidebar: [] }
    }
    console.log(`🔬 [${requestId}] 2단계: esummary 호출 (${idlist.length}건)`)

    const papers: PaperChunk[] = []
    for (const pmid of idlist) {
      const summaryUrl = `${BASE}/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json&api_key=${apiKey}`
      const summaryRes = await fetch(summaryUrl)
      if (!summaryRes.ok) continue
      const summaryData = await summaryRes.json()
      const item = summaryData?.result?.[pmid]
      const title = item?.title ?? 'Untitled'
      const abstract = typeof item?.abstract === 'string' ? item.abstract : ''
      papers.push({
        id: pmid,
        pmid,
        title,
        abstract: abstract || null,
        citation_count: 0,
        tldr: abstract ? abstract.slice(0, 300) + (abstract.length > 300 ? '...' : '') : null,
        chunk_text: abstract || title,
      })
      refsForSidebar.push({ pmid, title, authors: '', abstract })
    }
    console.log(`📚 [${requestId}] PubMed 논문 ${papers.length}건 수집 완료`)
    return { papers, refsForSidebar }
  } catch (err) {
    console.warn(`⚠️ [${requestId}] PubMed 검색 실패:`, err)
    return { papers: [], refsForSidebar: [] }
  }
}

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8).toUpperCase()
  console.log('\n' + '🏥'.repeat(25))
  console.log(`📩 [Chat API] 요청 시작 (ID: ${requestId})`)
  console.log('🏥'.repeat(25))

  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      console.log(`❌ [${requestId}] body JSON 오류`)
      return NextResponse.json({ error: 'JSON 형식 오류' }, { status: 400 })
    }

    const { message, recentActions, hesitationHint } = body
    if (!message || typeof message !== 'string') {
      console.log(`❌ [${requestId}] 메시지 없음`)
      return NextResponse.json({ error: '메시지가 필요합니다' }, { status: 400 })
    }

    const appContext: AppContextForAPI | null =
      Array.isArray(recentActions) || typeof hesitationHint === 'boolean'
        ? { recentActions: Array.isArray(recentActions) ? recentActions : [], hesitationHint: !!hesitationHint }
        : null

    console.log(`💬 [${requestId}] 메시지: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`)
    logEnvVariables(requestId)

    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log(`❌ [${requestId}] 인증 실패:`, authError?.message || '유저 없음')
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }
    console.log(`👤 [${requestId}] 사용자: ${user.email}`)

    const { allowed, count } = await checkDailyLimit(supabase, user.id)
    if (!allowed) {
      console.log(`⛔ [${requestId}] 일일 한도 초과: ${count}/${DAILY_LIMIT}`)
      return NextResponse.json({ error: `일일 사용 제한(${DAILY_LIMIT}회)을 초과했습니다.`, dailyLimit: true, count }, { status: 429 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('birth_date, gender, height, weight, conditions, medications')
      .eq('id', user.id)
      .single()
    if (profileError && profileError.code !== 'PGRST116') {
      console.log(`⚠️ [${requestId}] 프로필 로드 에러:`, profileError.message)
    }
    logHealthProfile(profile, user.id)

    let currentHealthContext: string | null = null
    try {
      const aggregate = await aggregateHealthContext(supabase, user.id)
      currentHealthContext = formatAggregateForPrompt(aggregate)
      console.log(`📊 [${requestId}] 건강 컨텍스트 집계 완료`)
    } catch (aggErr) {
      console.warn(`⚠️ [${requestId}] 건강 집계 실패:`, aggErr)
    }

    // 의학 관련 키워드 있으면 코드에서 먼저 PubMed 검색 (Tool Calling 없음)
    const needSearch = isAnalysisIntent(message)
    console.log(`📋 [${requestId}] 의학 키워드/분석 의도: ${needSearch ? '예 → PubMed 검색 수행' : '아니오'}`)

    let paperChunks: PaperChunk[] = []
    let refsForSidebar: { pmid: string; title: string; authors: string; abstract: string }[] = []

    if (needSearch) {
      const result = await searchPubMedPapers(requestId, message, 5)
      paperChunks = result.papers
      refsForSidebar = result.refsForSidebar
    }

    const systemPrompt = buildSystemPrompt(profile, currentHealthContext, appContext, paperChunks)
    console.log(`📝 [${requestId}] 시스템 프롬프트 길이: ${systemPrompt.length}자, 논문 블록: ${paperChunks.length}건`)

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey || openaiKey.length < 10) {
      console.error(`❌ [${requestId}] OPENAI_API_KEY 없음`)
      return NextResponse.json({ error: 'AI 서비스 API 키가 설정되지 않았습니다. OPENAI_API_KEY를 설정해주세요.' }, { status: 500 })
    }

    console.log(`🚀 [${requestId}] OpenAI Chat Completions 호출 (stream: true, model: ${OPENAI_MODEL})`)
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        max_tokens: 800,
        stream: true,
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error(`❌ [${requestId}] OpenAI API 오류: ${openaiRes.status}`, errText.slice(0, 300))
      return NextResponse.json({ error: 'AI 응답 생성에 실패했습니다.' }, { status: 502 })
    }

    await incrementUsage(supabase, user.id)
    console.log(`✅ [${requestId}] 사용량 증가 완료`)

    // 스트림: 먼저 __DRDOCENT_PAPERS__ (UI 호환), 이어서 OpenAI 스트림 전달
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (refsForSidebar.length > 0) {
            const prefix = `__DRDOCENT_PAPERS__${JSON.stringify(refsForSidebar.map((r) => ({ pmid: r.pmid, title: r.title, authors: r.authors, abstract: r.abstract })))}__END__\n\n`
            controller.enqueue(encoder.encode(prefix))
            console.log(`📤 [${requestId}] 논문 메타데이터 스트림 전송 (${refsForSidebar.length}건)`)
          }

          const reader = openaiRes.body?.getReader()
          const decoder = new TextDecoder()
          if (!reader) {
            controller.close()
            return
          }

          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') continue
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed?.choices?.[0]?.delta?.content
                  if (typeof content === 'string' && content) {
                    controller.enqueue(encoder.encode(content))
                  }
                } catch (_) {
                  // ignore parse error per line
                }
              }
            }
          }
          if (refsForSidebar.length > 0) {
            controller.enqueue(encoder.encode('\n\n---\n본 내용은 검색된 학술 논문을 기반으로 한 참고 정보이며, 정확한 진단과 치료는 반드시 의료진과 상담하시기 바랍니다. 참고한 논문은 우측 사이드바에서 확인하실 수 있습니다.'))
          }
          console.log(`✅ [${requestId}] 스트림 완료`)
        } catch (err) {
          console.error(`❌ [${requestId}] 스트림 처리 오류:`, err)
          controller.enqueue(encoder.encode('\n\n선생님, 일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error(`❌ [${requestId}] 예외:`, error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
