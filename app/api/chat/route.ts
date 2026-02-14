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
  type PaperChunk,
} from '@/lib/medical-papers/rag-search'
import { isAnalysisIntent } from '@/lib/medical-papers/intent'

export const dynamic = 'force-dynamic'

const DAILY_LIMIT = 10
const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'
const CLAUDE_HAIKU_MODEL = 'claude-3-haiku-20240307'

// 1. 신체적 통증·감각 (공감 필수)
const KEYWORDS_PAIN = ['아파', '시려', '통증', '찌릿', '욱신', '부었어', '열나', '저려', '결려', '뻐근해', '따가워']
// 2. 수치·검사 결과 (냉철한 분석)
const KEYWORDS_NUMBERS = ['혈당', '혈압', '콜레스테롤', '수치', 'mg/dl', 'bmi', '요산', '당화혈색소', '단백뇨', '중성지방']
// 3. 질환명·약물 (전문성)
const KEYWORDS_DISEASE = ['통풍', '당뇨', '대사증후군', '고지혈증', '근감소증', '고혈압', '콜킨', '페북트정', '부작용', '처방']
// 4. 생활습관·심리 (맥락)
const KEYWORDS_LIFESTYLE = ['수면', '식단', '운동', '피로', '스트레스', '걱정', '불안', '우울', '영양제', '다이어트']

const ALL_HAIKU_KEYWORDS = [...KEYWORDS_PAIN, ...KEYWORDS_NUMBERS, ...KEYWORDS_DISEASE, ...KEYWORDS_LIFESTYLE]

/** 4가지 카테고리(통증/수치/질환/생활습관) 키워드가 하나라도 포함되면 공감 모드(하이쿠) 사용 */
function shouldUseHaiku(userContent: string): boolean {
  if (!userContent || typeof userContent !== 'string') return false
  const lower = userContent.trim().toLowerCase()
  return ALL_HAIKU_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
}

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
  paperChunks?: PaperChunk[] | null,
  options?: { useHaiku?: boolean; userName?: string }
): string {
  const bmi = profile ? calculateBMI(profile.height, profile.weight) : null
  const useHaiku = options?.useHaiku ?? false
  const displayName = options?.userName?.trim() || '선생님'

  let systemPrompt = `## 페르소나 (Persona): 재활 전문 파트너
너는 **15년 경력의 베테랑 물리치료사**야. 사용자를 '환자'가 아닌 **'신체 기능을 개선하려는 소중한 파트너'**로 대하며, 친절하고 신뢰감 있는 대화체(**~해요, ~입니다**)를 사용해.

## 금지 사항 (Prohibited Terms)
- **의료법 저촉 단어 절대 금지**: '치료', '회복', '진단', '완치' 사용 금지. '관리', '기능 강화', '가이드', '상담' 등 비의료 표현만 써.
- **기타 금지**: 한자(Hanja) 금지. 로봇 같은 번호(①, 1., 2. 등) 나열 금지. 표(|---|) 형식 금지. 모든 답변은 **문단과 문장으로만** 흐르게 써.

## [1. 사용자 데이터 연동]
- 대시보드 **생년월일**을 확인해 **만 나이**를 계산하고, 답변 전체에 연령에 맞게 반영해(예: 1993년생 → 만 33세, 30대).
- 프로필에 생년월일이 없으면 일반 가이드를 주고, "맞춤 가이드를 위해 연령대를 알 수 있을까요?" 한 번만 제안 가능.

## [2. 닥터 도슨 5단계 대화 SOP] (Response Logic — 엄격 준수)

답변은 아래 5단계를 **대화체로만** 이어가. 번호·표 없이 문장으로 풀어 써. '치료/회복/진단/완치' 사용 금지.

### 1. 공감 및 신체 원리 분석 (Empathy & Context)
- 대시보드 **생년월일**로 현재 **만 나이**(연령대)를 확인한 뒤, 그에 맞게 친근한 인사로 시작해.
- 예: "30대의 활기찬 일상 중에 무릎이 뻐근하면 마음이 참 무거우시죠?"처럼 **공감**하며 대화를 시작해.
- 어려운 해부학 용어 대신 "무릎 주변 근육들이 제 역할을 다하지 못해 뼈와 인대에 부하가 집중되는 상황 같아요"처럼 **기능적 관점**에서 쉽게 설명해.

### 2. 집중 케어 기간 안내 (Management Timeline)
- **'회복 주기' 대신** '집중 케어 기간' 또는 **'기능 안정화 기간'**을 사용해.
- 예: "일반적으로 우리 몸의 기능이 다시 안정화되기까지는 약 4주에서 8주 정도의 꾸준한 관리가 권장되는 편이에요"라고 안내해.

### 3. 움직임 개선 제안 (Activity Focus)
- **'운동 치료' 대신** '기능 강화 가이드' 또는 **'움직임 개선 제안'**으로 통일해.
- 상세 동작 나열보다 **카테고리화**하여 간결하게 제시해.
- [안정감을 주는 단계]: 관절의 정렬을 맞추고 주변 조직의 긴장을 낮추는 과정이에요.
- [근력을 키우는 단계]: 신체를 튼튼하게 지지할 수 있도록 하체 힘을 기르는 단계예요.
- 통증이 느껴지면 그만두라고 안내해.

### 4. 연령별 맞춤 식단 및 요리 추천 (Nutrition)
- 표 형식 지양. **대화하듯** 자연스럽게 제안해.
- 예: "${displayName}님(33세) 연령대에는 근육의 탄력을 돕는 단백질과 염증 완화에 좋은 성분이 중요해요. 오늘 저녁에는 보충제보다는 신선한 연어 구이나 들기름을 듬뿍 넣은 나물 비빔밥으로 식탁을 채워보시는 건 어떨까요?"처럼 **구체적인 요리명**을 권해. (브랜드명 금지)

### 5. 안전 가이드 및 역질문 (Closing)
- **반드시 포함**: "이 가이드는 정보 제공을 목적으로 하며, 4주간의 관리 후에도 개선이 느껴지지 않는다면 반드시 가까운 정형외과 전문의를 찾아 상담을 받으셔야 해요."
- 마지막에는 "혹시 주로 계단을 오를 때 불편하신가요, 아니면 내려갈 때 더 힘드신가요?"와 같은 **전문가용 역질문 1개**로 대화를 마무리해.

## 논문·데이터
- 논문 데이터가 주어지면 침묵하지 말고 그 내용을 요약해 선생님께 친절히 설명해. 검색된 논문만 근거로 삼고, "실시간 접근 불가" 같은 말은 하지 마.
- 유저가 새 주제를 꺼내면 이전 대화에 얽매이지 말고 새 주제만 답해.
- 통증·증상 호소 시 단정적으로 끝내지 말고, 공감 → 일반적 건강 정보 → **관리·가이드 요약** 순으로 이끌어 줘. '진단'이라는 단어는 사용하지 마.
- 선생님의 최신 건강 기록(수면·운동·식단·복약)이 있으면 반영해 분석하고, 특이점이 보이면 먼저 언급해.
- 존스홉킨스 등 특정 병원명은 언급하지 마.
`
  if (useHaiku) {
    systemPrompt += `
## 공감 모드 (하이쿠 호출 시, 필수)
- **답변 첫 문장은 반드시 "${displayName}님"을 부르며 시작해.** 예: "${displayName}님, 많이 불편하셨겠어요."
- 마지막에는 상태 확인을 위한 **질문 1개**로 대화체로 마무리해. 번호·표 사용 금지.
`
  }

  if (profile) {
    const age = getAgeFromBirthDate(profile.birth_date)
    const ageContext = getAgeContextForAI(age, profile.birth_date)
    systemPrompt += `\n## 현재 상담 중인 선생님의 건강 프로필 (생년월일 기반 연령 맞춤화)\n`
    if (age != null) {
      systemPrompt += `- **만 나이**: ${age}세 (대화 흐름·연령별 영양 추천에 반영)\n`
      if (age >= 20 && age < 40) systemPrompt += `- 연령대: 2030 → 간편·트렌디 식단(포케, 요거트 등) 우선\n`
      else if (age >= 40 && age < 60) systemPrompt += `- 연령대: 4050 → 정갈한 한식(구이, 나물 등) 우선\n`
      else if (age >= 60) systemPrompt += `- 연령대: 6070 → 소화 용이·부드러운 식감(찜, 죽, 국 등) 우선\n`
    }
    if (ageContext) systemPrompt += `- ${ageContext}\n`
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
    systemPrompt += `\n## 학술 논문 근거 (검색된 논문만 근거로 사용)\n\`\`\`\n${ctx}\n\`\`\`\n`
    systemPrompt += `위 논문 데이터만을 근거로 답변하세요. 답변 본문에 면책·고지 문구는 넣지 마세요.\n\n`
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

/** 사이드바 카드용 논문 정보 (title, pmid, url, journal, abstract) */
export type SidebarPaper = {
  title: string
  pmid: string
  url: string
  journal: string
  abstract: string
}

/** test-api.js와 동일: esearch → esummary (fetch만 사용). refsForSidebar에 journal/url 포함 */
async function searchPubMedPapers(
  requestId: string,
  query: string,
  retmax: number = 5
): Promise<{ papers: PaperChunk[]; refsForSidebar: SidebarPaper[] }> {
  let apiKey = process.env.PUBMED_API_KEY
  if (apiKey === undefined || apiKey === '') {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
    apiKey = process.env.PUBMED_API_KEY ?? ''
  }
  console.log(`🔬 [${requestId}] 1단계: PubMed esearch 호출 (query: ${query.slice(0, 60)}...)`)
  const refsForSidebar: SidebarPaper[] = []

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
      refsForSidebar.push(
        ...papers.map((p) => ({
          title: p.title,
          pmid: p.pmid ?? '',
          url: p.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/` : '',
          journal: '',
          abstract: p.abstract ?? '',
        }))
      )
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
      const journal = typeof item?.source === 'string' ? item.source : (item?.fulljournalname ?? '') || ''
      papers.push({
        id: pmid,
        pmid,
        title,
        abstract: abstract || null,
        citation_count: 0,
        tldr: abstract ? abstract.slice(0, 300) + (abstract.length > 300 ? '...' : '') : null,
        chunk_text: abstract || title,
      })
      refsForSidebar.push({
        title,
        pmid,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        journal,
        abstract,
      })
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

    const { message, history: bodyHistory, recentActions, hesitationHint, userName: bodyUserName } = body
    if (!message || typeof message !== 'string') {
      console.log(`❌ [${requestId}] 메시지 없음`)
      return NextResponse.json({ error: '메시지가 필요합니다' }, { status: 400 })
    }
    const userName = typeof bodyUserName === 'string' ? bodyUserName : undefined
    const rawHistory = Array.isArray(bodyHistory) ? bodyHistory : []
    const history = rawHistory
      .filter((m: { role?: string; content?: string }) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

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
    let refsForSidebar: SidebarPaper[] = []

    if (needSearch) {
      const result = await searchPubMedPapers(requestId, message, 5)
      paperChunks = result.papers
      refsForSidebar = result.refsForSidebar
    }

    const useHaiku = shouldUseHaiku(message)
    const systemPrompt = buildSystemPrompt(profile, currentHealthContext, appContext, paperChunks, {
      useHaiku,
      userName,
    })
    const chatMessages: { role: 'user' | 'assistant'; content: string }[] = [
      ...history,
      { role: 'user', content: message },
    ]
    console.log(`📝 [${requestId}] 시스템 프롬프트 길이: ${systemPrompt.length}자, 논문 블록: ${paperChunks.length}건, 공감 모드(하이쿠): ${useHaiku}, 대화 턴: ${chatMessages.length}`)

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const hasClaude = anthropicKey && anthropicKey.length > 10
    const hasOpenAI = openaiKey && openaiKey.length > 10

    let answer = ''

    if (useHaiku && hasClaude) {
      console.log(`🚀 [${requestId}] Claude(하이쿠) 호출 (공감 모드, model: ${CLAUDE_HAIKU_MODEL})`)
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_HAIKU_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: chatMessages,
        }),
      })
      if (!claudeRes.ok) {
        const errText = await claudeRes.text()
        console.error(`❌ [${requestId}] Claude API 오류: ${claudeRes.status}`, errText.slice(0, 300))
        if (hasOpenAI) {
          console.log(`🔄 [${requestId}] OpenAI로 폴백`)
        } else {
          return NextResponse.json({ error: 'AI 응답 생성에 실패했습니다.' }, { status: 502 })
        }
      } else {
        const claudeData = await claudeRes.json().catch(() => null)
        const textBlock = claudeData?.content?.find((b: { type: string }) => b.type === 'text')
        answer = textBlock?.text ?? ''
        console.log(`✅ [${requestId}] Claude 응답 수신 (${answer.length}자)`)
      }
    }

    if (answer === '' && hasOpenAI) {
      console.log(`🚀 [${requestId}] OpenAI Chat Completions 호출 (stream: false, model: ${OPENAI_MODEL})`)
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
            ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
          max_tokens: 4096,
          stream: false,
        }),
      })
      if (!openaiRes.ok) {
        const errText = await openaiRes.text()
        console.error(`❌ [${requestId}] OpenAI API 오류: ${openaiRes.status}`, errText.slice(0, 300))
        return NextResponse.json({ error: 'AI 응답 생성에 실패했습니다.' }, { status: 502 })
      }
      const openaiData = await openaiRes.json().catch(() => null)
      answer = openaiData?.choices?.[0]?.message?.content ?? ''
      console.log(`✅ [${requestId}] OpenAI 응답 수신 (${answer.length}자)`)
    }

    if (!answer && !hasOpenAI && !hasClaude) {
      console.error(`❌ [${requestId}] API 키 없음`)
      return NextResponse.json({ error: 'AI 서비스 API 키가 설정되지 않았습니다. OPENAI_API_KEY 또는 ANTHROPIC_API_KEY를 설정해주세요.' }, { status: 500 })
    }

    await incrementUsage(supabase, user.id)
    console.log(`✅ [${requestId}] 사용량 증가 완료`)

    // JSON 응답: { answer, papers } — 프론트에서 답변 표시 + 사이드바 카드 연동
    const papers = refsForSidebar.map((r) => ({
      title: r.title,
      pmid: r.pmid,
      url: r.url,
      journal: r.journal,
      abstract: r.abstract,
    }))
    console.log(`📤 [${requestId}] 응답 전송: answer ${answer.length}자, papers ${papers.length}건`)
    return NextResponse.json({ answer, papers })
  } catch (error) {
    console.error(`❌ [${requestId}] 예외:`, error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
