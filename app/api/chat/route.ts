/**
 * 닥터 도슨 채팅 API (표준 OpenAI API 호출 방식)
 *
 * 순차 로직: 유저 질문 → (의학 키워드 시) PubMed 검색 → 프롬프트에 결과 합침 → OpenAI 답변 생성
 * Tool Calling 없이, 코드에서 검색 후 AI에 데이터 전달.
 *
 * [실행 위치] 서버 전용. 이 파일은 'use client' 없음 → Next.js API Route (Node.js 런타임).
 * [Edge 아님] export const runtime = 'edge' 없음 → process.env 사용이 맞음 (Edge면 env 객체 검토 필요).
 * [환경변수] 개발 시 .env.local 강제 로드(override: false). Vercel은 대시보드 주입만 사용.
 */
import dotenv from 'dotenv'
import path from 'path'
import { NextResponse } from 'next/server'

// 서버 전용: .env.local 강제 로드 (보안 키 누락 시 production 포함 시도. override: false로 기존 값 유지)
const needsEnvLoad =
  typeof process !== 'undefined' &&
  (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.MFDS_DRUG_INFO_API_KEY?.trim())
if (needsEnvLoad) {
  dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: false })
}
// Vercel build trigger: 재배포 시 환경 변수 새로 주입 확인용 (제거 가능)

console.log('--- VERCEL ENV KEYS ALL ---')
console.log(Object.keys(process.env).sort().join(', '))
console.log('---------------------------')
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAgeFromBirthDate, getAgeContextForAI } from '@/utils/health'
import { aggregateHealthContext, formatAggregateForPrompt } from '@/utils/health-aggregator'
import {
  searchRelevantPapers,
  formatPaperContext,
  type PaperChunk,
} from '@/lib/medical-papers/rag-search'
import { isAnalysisIntent, isFoodOrNutrientIntent, extractFoodSearchQuery, isLikelyFoodName, isDrugIntent, extractDrugSearchQuery } from '@/lib/medical-papers/intent'
import { searchAndFetchCached } from '@/lib/pubmed'
import { translateToPubMedQuery } from '@/lib/pubmed-query'
import { searchAndGetNutrients, formatUsdaContextForPrompt } from '@/lib/usda'
import { searchFoodKnowledge } from '@/lib/food-knowledge-search'
import { runDniInference } from '@/lib/dni-inference'
import { runDrugRag } from '@/lib/drug-rag'
import { createAdminClient } from '@/utils/supabase/admin'

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

// ——— 다중 의미 단어 확인 단계 (Detection List) ———
// 한국·외국에서 의미가 다르거나 다중적인 단어 → 감지 시 의도 확인 또는 양쪽 고려 후 답변
const AMBIGUOUS_TERMS: Array<{ pattern: RegExp; term: string; meaningA: string; meaningB: string }> = [
  { pattern: /\bpt\b|피티/i, term: 'PT', meaningA: '병원에서의 재활 물리치료(Physical Therapy)', meaningB: '센터에서의 웨이트 트레이닝·개인 운동 강습(Personal Training)' },
  { pattern: /\bot\b|오티/i, term: 'OT', meaningA: '작업치료(Occupational Therapy)', meaningB: '연장근무·오버타임(Overtime)' },
  { pattern: /\bdiet\b|다이어트/i, term: 'Diet', meaningA: '치료식·식단(Clinical Nutrition)', meaningB: '체중 감량(Weight Loss)' },
  { pattern: /\bconditioning\b|컨디셔닝/i, term: 'Conditioning', meaningA: '재활 컨디셔닝(Rehabilitation)', meaningB: '체력 단련(Physical Prep)' },
]

const MEDICAL_CONTEXT_HINTS = ['병원', '의사', '처방', '재활', '정형외과', '치료받', '수술', '진료', '처방전', '물리치료', '작업치료', '재활치료', '클리닉']

export interface AmbiguousHint {
  terms: Array<{ term: string; meaningA: string; meaningB: string }>
  hasMedicalContext: boolean
}

/** 사용자 질문에 모호한 키워드(PT/OT/Diet/Conditioning)가 포함돼 있는지 확인 */
function detectAmbiguousTerms(userMessage: string): AmbiguousHint | null {
  if (!userMessage || typeof userMessage !== 'string') return null
  const text = userMessage.trim()
  const lower = text.toLowerCase()
  const detected: Array<{ term: string; meaningA: string; meaningB: string }> = []
  for (const { pattern, term, meaningA, meaningB } of AMBIGUOUS_TERMS) {
    if (pattern.test(text)) detected.push({ term, meaningA, meaningB })
  }
  if (detected.length === 0) return null
  const hasMedicalContext = MEDICAL_CONTEXT_HINTS.some((h) => lower.includes(h.toLowerCase()))
  return { terms: detected, hasMedicalContext }
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
  options?: {
    useHaiku?: boolean
    userName?: string
    ambiguousHint?: AmbiguousHint | null
    usdaContext?: string | null
    foodKnowledgeContext?: string | null
    dniCautionGuide?: string | null
    drugContext?: string | null
    drugQueryMissing?: boolean
  }
): string {
  const bmi = profile ? calculateBMI(profile.height, profile.weight) : null
  const useHaiku = options?.useHaiku ?? false
  const displayName = options?.userName?.trim() || '선생님'
  const ambiguousHint = options?.ambiguousHint ?? null
  const usdaContext = options?.usdaContext ?? null
  const foodKnowledgeContext = options?.foodKnowledgeContext ?? null
  const dniCautionGuide = options?.dniCautionGuide ?? null
  const drugContext = options?.drugContext ?? null
  const drugQueryMissing = options?.drugQueryMissing ?? false

  let systemPrompt = `## [최우선 — 15년 차 베테랑 물리치료사의 임상 상담 스타일]

### 페르소나 및 화법 (The Master's Voice)
- 너는 환자의 아픔을 내 아픔처럼 느끼는 **15년 차 재활 전문 물리치료사**야.
- **첫인상**: "${displayName}님, 샌드위치 가게에서 손을 많이 쓰시다 보니 손목이 욱신거려 고생이 많으시죠?"처럼 사용자의 상황(알바·직업·나이 등)을 즉시 반영한 **공감으로 시작**해. "최근 연구에 따르면~" 같은 학술적 도입은 금지.
- 논문은 대화의 **배경**으로만 쓰고, 출처는 상담이 **완전히 끝난 뒤** 화면 맨 하단에만 표시돼. 본문 중간에 링크·출처 목록 금지.

### PubMed 인용 (상담 흐름에 맞는 인용)
- PMID 번호만 던지지 마. **"이러한 관리가 왜 필요한지 연구 결과(PMID: XXXXXX)가 뒷받침해 주고 있어요"**, **"실제 임상에서도 이런 방식의 효과가 보고된 바 있어요(PMID: XXXXXX)"**처럼 전문가 상담 흐름에 맞게 문맥을 먼저 말한 뒤 연구 결과(PMID)를 자연스럽게 이어 줘.
- 논문 번호를 문장 맨 앞에 두지 말고, "왜 이렇게 하면 좋은지" 설명한 다음 인용해.

### 금지 사항 (절대 — 위반 시 답변 품질 저하)
- **번호·단계 표기 금지**: 1., 2., ①, ②, **1단계**, **2단계**, **3단계**, **4단계** 등 어떤 형태의 번호 매기기도 사용하지 마.
- **리스트 기호 금지**: 불릿(•), 하이픈(-), 별표(*) 등 목록 형태로 나열하지 마.
- **대괄호 카테고리 금지**: [안정화 단계], [근력 강화 단계] 같은 괄호 제목 사용 금지.
- **이상한·비정상 표현 금지**: "고양이 기라는", "~라는 스트레칭"처럼 문법이 어색하거나 단어가 섞여 보이는 표현을 쓰지 마. 스트레칭·운동명은 **정확한 우리말 또는 통용어**만 사용해. 예: "고양이 자세 스트레칭", "캣 카우 스트레칭" (O) / "고양이 기라는 스트레칭" (X).
- **한자 및 한자어 금지**: 屈伸, 伸展 같은 **한자**를 직접 쓰지 마. 어려운 한자어는 모두 쉬운 우리말로 풀어 써. 답변은 **한글과 쉬운 말**만 사용해.
- **형식**: 15년 차 물리치료사가 옆에서 말해주는 듯한 **구어체 산문**만 사용해. 오직 **연결어(무엇보다, 아울러, 특히, 그다음으로)**로만 흐름을 이어 가고, 번호나 리스트는 절대 쓰지 마.
- **말투**: ~해요, ~입니다, ~네요 만 사용. 표(|---|) 금지.

## 의료법 준수
- '치료', '회복', '진단', '완치' 사용 금지. '관리', '기능 강화', '가이드', '상담' 등만 써.

## [1. 사용자 데이터 연동]
- 대시보드 **생년월일**로 **만 나이**를 계산하고, 답변 전체에 연령에 맞게 반영해(예: 1993년생 → 만 33세).
- 프로필에 생년월일이 없으면 일반 가이드를 주고, "맞춤 가이드를 위해 연령대를 알 수 있을까요?" 한 번만 제안 가능.

## 상담 흐름 (구어체 산문만 — 번호·리스트 사용 금지)

아래 내용을 **번호 없이**, 15년 차 물리치료사가 말하듯 **문단과 연결어**로만 풀어 써. "1단계", "2단계" 같은 표기는 절대 쓰지 마.

먼저 **원인과 메커니즘**을 쉬운 말로: "반복적으로 빵을 썰거나 재료를 담을 때 손목 터널을 지나는 정중신경이 압박을 받기 쉬워요"처럼 논문 번호 없이 임상적 원리를 풀어 줘.

아울러 **생활 속 관리**를 실행 가능하게: "${displayName}님(33세)께는 지금 당장 거창한 운동보다, 일하시는 중간중간 손등을 몸 쪽으로 당겨주는 가벼운 스트레칭이 훨씬 시급해요"처럼 조언을 건네. 인용은 "이러한 관리가 왜 필요한지 연구 결과(PMID: XXXXXX)가 뒷받침해 주고 있어요"처럼 상담 흐름에 맞게.

특히 **맞춤형 영양과 휴식**: "오늘 저녁엔 근육의 긴장을 풀어주는 마그네슘이 풍부한 견과류나 시금치 나물을 곁들인 식사를 챙겨보시는 건 어떨까요?"처럼 구체적인 요리명으로 추천(연어 구이, 나물 비빔밥 등). 브랜드명 금지. 집중 케어 기간은 원인·심각도에 따라 차별화(가벼우면 1~2주, 급성 2~4주, 만성 6~12주).

마지막에 **안전 가이드**와 다정한 역질문: "4주 정도 관리해도 통증이 남는다면 정형외과 전문의를 꼭 찾아가 보세요" + 상태 확인을 위한 질문 하나.

참고 문헌은 답변 본문에 적지 말고, 상담이 완전히 끝난 후 화면 맨 하단 "🔗 닥터 도슨이 참고한 연구 논문"으로 최대 3개만 표시됨.

## 논문·데이터
- 논문 데이터가 주어지면 침묵하지 말고 그 내용을 요약해 선생님께 친절히 설명해. 검색된 논문만 근거로 삼고, "실시간 접근 불가" 같은 말은 하지 마.
- 유저가 새 주제를 꺼내면 이전 대화에 얽매이지 말고 새 주제만 답해.
- 통증·증상 호소 시 단정적으로 끝내지 말고, 공감 → 일반적 건강 정보 → **관리·가이드 요약** 순으로 이끌어 줘. '진단'이라는 단어는 사용하지 마.
- 선생님의 최신 건강 기록(수면·운동·식단·복약)이 있으면 반영해 분석하고, 특이점이 보이면 먼저 언급해.
- 존스홉킨스 등 특정 병원명은 언급하지 마.
`
  if (ambiguousHint && ambiguousHint.terms.length > 0) {
    systemPrompt += `\n## [다중 의미 단어 확인] (고정 로직 — 건너뛰지 말 것)\n`
    systemPrompt += `사용자 질문에 **모호한 키워드**가 포함되어 있음. 본문 답변을 하기 **전에** 반드시 확인 질문을 먼저 해.\n\n`
    for (const { term, meaningA, meaningB } of ambiguousHint.terms) {
      systemPrompt += `- **"${term}"**: ${meaningA} vs ${meaningB}\n`
    }
    systemPrompt += `\n### PT 고정 로직 (필수)\n`
    systemPrompt += `사용자가 **'PT'**를 언급하면, 질문에 대한 답변을 이어가기 **전에** 반드시 다음 확인을 먼저 해: **"병원에서 받으시는 물리치료를 말씀하시는 걸까요, 아니면 헬스장에서의 개인 운동(웨이트 트레이닝)을 말씀하시는 걸까요?"** — 즉 "병원 물리치료인지 헬스장 운동인지" 다정하게 먼저 물어본 뒤, 사용자 맥락에 맞게 답변을 이어 가. 이 단계를 생략하지 마.\n`
    systemPrompt += `다른 모호어(OT, Diet, Conditioning)도 **답변 서두**에 15년 차 물리치료사 말투로 확인 문구를 넣어. "정확한 도움을 드리고 싶은 마음에 먼저 여쭤보게 되었어요." 같은 배려 문구를 사용해.\n\n`
    if (ambiguousHint.hasMedicalContext) {
      systemPrompt += `### 맥락: 병원·의사·처방 등이 언급됨 → 의료 의미로 우선 판단\n`
      systemPrompt += `"병원에서 권유받으신 만큼 물리치료(또는 해당 의미)를 중심으로 설명해 드릴게요"라고 명시한 뒤 해당 의미로 답변해.\n\n`
    } else {
      systemPrompt += `### 맥락: 불분명 → 두 가지 경우 모두 고려\n`
      systemPrompt += `두 가지 의미의 **핵심 관리법을 짧게 요약**한 뒤, 사용자의 선택을 유도하는 다정한 문장으로 마무리해.\n\n`
    }
  }
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
    systemPrompt += `\n## [필수] 학술 논문 — 대화의 배경으로만 사용\n\`\`\`\n${ctx}\n\`\`\`\n`
    systemPrompt += `위 논문 핵심을 대화 속에 녹여서 설명해. 인용 시 PMID 번호만 던지지 말고, **"이러한 관리가 왜 필요한지 연구 결과(PMID: XXXXXX)가 뒷받침해 주고 있어요"**처럼 상담 흐름에 맞게 문맥을 먼저 말한 뒤 PMID를 이어 줘. 상담이 완전히 끝난 뒤 "🔗 닥터 도슨이 참고한 연구 논문"으로 최대 3개만 하단에 표시됨.\n\n`
  }

  if (usdaContext) {
    systemPrompt += `\n## [필수] USDA 표준 영양 데이터 (100g당, 정밀 수치)\n\`\`\`\n${usdaContext}\n\`\`\`\n`
    systemPrompt += `**데이터 신뢰성 강조 — USDA 문구 필수**: 위 영양 데이터를 사용할 경우, 해당 수치를 말하는 **문장 서두에 반드시** 「USDA 표준 데이터에 따르면~」을 포함해. 문장 중간·끝만이 아니라, 칼로리·단백질·비타민 등 수치를 인용하는 **그 문장의 맨 앞**에 두어. 모든 영양 데이터는 단위 **g, mg, kcal**로만 출력해.\n\n`
  }

  if (foodKnowledgeContext) {
    systemPrompt += `\n## [참고] 내부 DB — 관리 팁·레시피\n\`\`\`\n${foodKnowledgeContext}\n\`\`\`\n`
    systemPrompt += `위 내용은 식품별 관리 팁·레시피 참고용이야. USDA 수치와 함께 활용해 설명해.\n\n`
  }

  if (dniCautionGuide) {
    systemPrompt += `\n## [필수 — 데이터 기반 주의 가이드]\n\`\`\`\n${dniCautionGuide}\n\`\`\`\n`
    systemPrompt += `위 내용은 **확진·진단이 아닌 참고용 가이드**야. 답변 말미에 반드시 이 주의 가이드 블록을 자연스럽게 포함해. "진단이 아니며 참고용입니다", "필요 시 의료진·약사 상담을 권합니다" 톤을 유지해.\n\n`
  }

  if (drugContext) {
    systemPrompt += `\n## [필수 — 식약처 의약품 공식 데이터]\n`
    systemPrompt += `아래는 식약처 공공데이터 또는 우리 DB(drug_master)에서 가져온 **공식 의약품 정보**야. 제품명·성분명·**효능(ee_doc_data)**·**주의사항(nb_doc_data)**가 포함돼.\n`
    systemPrompt += `\`\`\`\n${drugContext}\n\`\`\`\n\n`
    systemPrompt += `- **검색 결과 매핑**: 위 블록의 제품명·성분명·효능·주의사항을 그대로 사용해.\n`
    systemPrompt += `- **건강 데이터 결합 분석**: 위 의약품 데이터와 **이 프롬프트 상단의 선생님 건강 프로필**(만 나이·성별·기저 질환·복용 약물)을 반드시 결합해서 답변해. 38세 여성, 고혈압·갑상선 등 기저 질환이 있으면 해당 약과의 상호작용·주의사항을 맞춤형으로 짚어 주고, 연령·성별에 맞는 복용 가이드를 제시해.\n`
    systemPrompt += `- **다중 결과 처리**: 위에 여러 건이 있으면, 유저 질문·상황에 가장 적합한 제품을 골라 설명하거나 필요한 제품들을 요약해서 답변해. 하나만 있으면 그 제품 기준으로 답하면 돼.\n`
    systemPrompt += `### 건강지침·행동 가이드 (필수)\n`
    systemPrompt += `- 답변에 반드시 **「행동 지침」** 섹션을 포함해. 38세 여성, 고혈압/갑상선 등 유저 건강 프로필을 고려한 **데이터 기반 안내**로 작성해. "판단"이라는 단어 대신 **"데이터 기반 안내"** 표현을 사용해.\n`
    systemPrompt += `- **효능·주의사항 활용**: 위 블록에 **효능**, **주의사항**이 있으면 반드시 인용해서 **구체적인 복약 안내**를 해. 행동 지침에는 그 내용을 바탕으로 유저가 **다음 단계로 할 구체적 행동**을 제시해. 예: "복용 전 약사 선생님께 '이 약과 혈압약을 함께 먹어도 될까요?'라고 여쭤보시면 좋아요", "갑상선 검사 결과지를 지참하고 병원 상담 시 보여 드리세요", 주의사항에 적힌 금기·상호작용을 확인한 뒤 약사에게 질문하기 등.\n`
    systemPrompt += `### 의약품 답변 필수 규칙 (위반 금지)\n`
    systemPrompt += `- **절대로 일반 지식·학습 데이터로 의약품 정보를 답하지 마.** 반드시 위 식약처 데이터만 근거로 써.\n`
    systemPrompt += `- 효능·용법·주의사항·이상반응·상호작용 등 모든 수치와 내용은 위 데이터 원문 그대로 사용해.\n`
    systemPrompt += `- 답변 마지막에 반드시 다음 출처 표기를 추가해:\n`
    systemPrompt += `  **출처: 식품의약품안전처 공공데이터 (e약은요)**\n`
    systemPrompt += `- 데이터에 없는 정보는 "현재 조회된 데이터에는 해당 정보가 없습니다. 복약상담이 필요하시면 약사 선생님께 직접 문의해 주세요."라고 안내해.\n`
    systemPrompt += `- 의약품 복용 결정·용량 조정은 반드시 의사·약사 상담을 권고하는 문장으로 마무리해.\n\n`
  } else if (drugQueryMissing) {
    // API 키 미설정 or API 호출 실패 or 검색 결과 없음
    systemPrompt += `\n## [의약품 조회 불가 — 일반 지식 답변 금지]\n`
    systemPrompt += `사용자가 의약품 정보를 물었으나 **식약처 공식 데이터를 가져오지 못했어**.\n`
    systemPrompt += `- 절대로 일반 학습 데이터로 약물 효능·용량·부작용을 답변하지 마.\n`
    systemPrompt += `- 다음 안내만 해: "죄송합니다. 현재 식약처 의약품 데이터베이스에서 해당 정보를 조회하지 못했어요. 정확한 복약 정보는 약사 선생님이나 식품의약품안전처 의약품통합정보시스템(https://nedrug.mfds.go.kr)에서 확인하시길 권해 드려요."\n\n`
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

/**
 * RAG 파이프라인: 한국어 질문 → 영어 검색어 변환 → PubMed 검색(캐시) → PaperChunk + Sidebar 반환
 * PUBMED_API_KEY 없으면 DB RAG(searchRelevantPapers) fallback
 */
async function runPubMedRag(
  requestId: string,
  userMessage: string,
  retmax: number = 5
): Promise<{ papers: PaperChunk[]; refsForSidebar: SidebarPaper[] }> {
  const apiKey = process.env.PUBMED_API_KEY ?? ''
  const refsForSidebar: SidebarPaper[] = []

  if (!apiKey || apiKey.length === 0) {
    console.log(`⚠️ [${requestId}] PUBMED_API_KEY 없음 → DB RAG fallback`)
    try {
      const chunks = await searchRelevantPapers(userMessage, retmax)
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

  try {
    const englishQuery = await translateToPubMedQuery(userMessage)
    const searchQuery = englishQuery || userMessage
    console.log(`🔬 [${requestId}] PubMed 검색어(번역): "${searchQuery.slice(0, 60)}${searchQuery.length > 60 ? '...' : ''}"`)
    const results = await searchAndFetchCached(searchQuery, retmax)
    const papers: PaperChunk[] = results.map((p) => ({
      id: p.pmid,
      pmid: p.pmid,
      title: p.title,
      abstract: p.abstract || null,
      citation_count: 0,
      tldr: p.abstract ? p.abstract.slice(0, 300) + (p.abstract.length > 300 ? '...' : '') : null,
      chunk_text: p.abstract || p.title,
    }))
    refsForSidebar.push(
      ...results.map((p) => ({
        title: p.title,
        pmid: p.pmid,
        url: p.url,
        journal: '',
        abstract: p.abstract,
      }))
    )
    console.log(`📚 [${requestId}] PubMed 논문 ${papers.length}건 수집 완료 (캐시 적용 가능)`)
    return { papers, refsForSidebar }
  } catch (err) {
    console.warn(`⚠️ [${requestId}] PubMed RAG 실패:`, err)
    return { papers: [], refsForSidebar: [] }
  }
}

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8).toUpperCase()

  // 환경변수 로드 확인 (키 이름·존재 여부만, 값 노출 없음)
  const CHAT_RELEVANT_KEYS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_USDA_KEY',
    'MFDS_DRUG_INFO_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'PUBMED_API_KEY',
  ] as const
  const available = CHAT_RELEVANT_KEYS.filter((k) => {
    const v = process.env[k]
    return v !== undefined && v !== null && String(v).trim().length > 0
  })
  const missing = CHAT_RELEVANT_KEYS.filter((k) => !available.includes(k))
  console.log('AVAILABLE KEYS (Chat 관련):', available.join(', '))
  if (missing.length > 0) {
    console.log('MISSING KEYS (undefined/empty):', missing.join(', '))
    if (missing.includes('SUPABASE_SERVICE_ROLE_KEY') || missing.includes('MFDS_DRUG_INFO_API_KEY')) {
      console.log('[Vercel] 누락된 키는 대시보드에서 다음을 확인하세요:')
      console.log('  1. Project → Settings → Environment Variables')
      console.log('  2. 이름 정확히: SUPABASE_SERVICE_ROLE_KEY, MFDS_DRUG_INFO_API_KEY (대문자, 밑줄만)')
      console.log('  3. Production 체크 (및 Preview 필요 시 체크) 후 Save')
      console.log('  4. Deployments → 최신 배포 ⋮ → Redeploy (캐시 없이)')
    }
  }
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'OK' : '(undefined)')
  console.log('Supabase ServiceRole:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'OK' : '(undefined)')
  console.log('MFDS_DRUG_INFO_API_KEY:', process.env.MFDS_DRUG_INFO_API_KEY ? 'OK' : '(undefined)')

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

    const needSearch = isAnalysisIntent(message)
    const needFoodRag = isFoodOrNutrientIntent(message)
    const needDrugRag = isDrugIntent(message)
    const foodQuery = needFoodRag ? (extractFoodSearchQuery(message) || message.slice(0, 40).trim()) : ''
    const drugQuery = needDrugRag ? (extractDrugSearchQuery(message) || message.slice(0, 40).trim()) : ''
    console.log(`📋 [${requestId}] 분석의도: ${needSearch ? 'Y' : 'N'}, 음식·영양: ${needFoodRag ? 'Y' : 'N'}${foodQuery ? ` ("${foodQuery}")` : ''}, 의약품: ${needDrugRag ? 'Y' : 'N'}${drugQuery ? ` ("${drugQuery}")` : ''}`)

    let paperChunks: PaperChunk[] = []
    let refsForSidebar: SidebarPaper[] = []
    let usdaContext: string | null = null
    let foodKnowledgeContext: string | null = null
    let dniCautionGuide: string | null = null
    let drugContext: string | null = null
    let drugQueryMissing = false

    if (needFoodRag && foodQuery) {
      // 추출된 검색어가 증상·형용사면 USDA는 건너뛰고 PubMed·내부 DB만 사용
      const useUsda = isLikelyFoodName(foodQuery)
      if (!useUsda) {
        console.log(`📋 [${requestId}] 검색어 "${foodQuery}"는 식품 명칭이 아님 → USDA 호출 생략 (PubMed·내부 DB만 사용)`)
      }
      // Vercel 배포 시 .env.local은 업로드되지 않음 → 대시보드에서 NEXT_PUBLIC_USDA_KEY 필수 등록
      const usdaKey = useUsda ? (process.env.NEXT_PUBLIC_USDA_KEY ?? '').trim() : ''
      if (useUsda && !usdaKey) {
        console.warn(`⚠️ [${requestId}] NEXT_PUBLIC_USDA_KEY 미설정 — 영양 데이터 조회 생략. Vercel: Project → Settings → Environment Variables에 Key: NEXT_PUBLIC_USDA_KEY 추가 후 재배포`)
      }
      const [foodRows, usdaItems] = await Promise.all([
        searchFoodKnowledge(supabase as any, foodQuery, 5),
        useUsda && usdaKey
          ? searchAndGetNutrients(usdaKey, foodQuery, 2).catch((err) => {
              const msg = err instanceof Error ? err.message : String(err)
              console.warn(`⚠️ [${requestId}] USDA 조회 실패:`, msg)
              return []
            })
          : Promise.resolve([]),
      ])
      if (usdaItems.length > 0) {
        usdaContext = formatUsdaContextForPrompt(usdaItems)
        console.log(`🥗 [${requestId}] USDA 영양 데이터 ${usdaItems.length}건 주입`)
      } else if (usdaKey) {
        console.log(`📋 [${requestId}] USDA 검색 결과 없음 (검색어: "${foodQuery}")`)
      }
      if (foodRows.length > 0) {
        foodKnowledgeContext = foodRows
          .map((r) => {
            const parts = [`[${r.food_name}]`]
            if (r.clinical_insight) parts.push(`관리 팁: ${r.clinical_insight}`)
            if (r.synthetic_qa) parts.push(`Q&A: ${r.synthetic_qa}`)
            if (r.calories != null) parts.push(`칼로리 ${r.calories}kcal 등`)
            return parts.join('\n')
          })
          .join('\n\n')
        console.log(`📂 [${requestId}] 내부 DB food_knowledge ${foodRows.length}건 (관리 팁·레시피) 주입`)
      }
      if (usdaItems.length > 0) {
        try {
          const admin = createAdminClient()
          const dniResult = await runDniInference(admin, user.id, usdaItems)
          if (dniResult.hasConflict && dniResult.cautionGuideMessage) {
            dniCautionGuide = dniResult.cautionGuideMessage
            console.log(`⚠️ [${requestId}] DNI 충돌 ${dniResult.conflicts.length}건 → 주의 가이드 주입`)
          }
        } catch (dniErr) {
          console.warn(`⚠️ [${requestId}] DNI 추론 실패:`, dniErr instanceof Error ? dniErr.message : String(dniErr))
        }
      }
    }

    // ── 의약품 RAG (식약처 e약은요 API) ──────────────────────────────────────
    // 실행 위치: Next.js API Route (서버 전용). createAdminClient/runDrugRag는 클라이언트 번들에 포함되지 않음.
    if (needDrugRag && drugQuery) {
      console.log(`💊 [${requestId}] 의약품 RAG 시작: "${drugQuery}"`)
      // 디버깅: 서버가 Supabase/Service Role 환경변수를 보는지 확인 (값은 출력하지 않음)
      console.log(`[${requestId}] [Drug RAG] URL:`, process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(undefined)')
      console.log(`[${requestId}] [Drug RAG] ServiceKey Exist:`, !!process.env.SUPABASE_SERVICE_ROLE_KEY)
      console.log(`[${requestId}] [Drug RAG] MFDS_DRUG_INFO_API_KEY Exist:`, !!process.env.MFDS_DRUG_INFO_API_KEY)
      try {
        const admin = createAdminClient()
        const drugResult = await runDrugRag(requestId, drugQuery, admin)
        drugContext = drugResult.drugContext
        if (drugContext) {
          console.log(`💊 [${requestId}] 의약품 데이터 주입 완료 (${drugResult.itemCount}건, API=${drugResult.apiUsed})`)
        } else {
          // 데이터 없거나 API 실패 → 일반 지식 답변 금지 플래그
          drugQueryMissing = true
          console.warn(`⚠️ [${requestId}] 의약품 데이터 조회 실패 → 일반 지식 답변 금지 주입`)
        }
      } catch (err) {
        drugQueryMissing = true
        console.error(`❌ [${requestId}] drug RAG 예외:`, err instanceof Error ? err.message : String(err))
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    if (needSearch || needFoodRag) {
      const result = await runPubMedRag(requestId, message, 5)
      paperChunks = result.papers
      refsForSidebar = result.refsForSidebar
      console.log(`📚 [${requestId}] RAG 반환: paperChunks=${paperChunks.length}건, refsForSidebar=${refsForSidebar.length}건`)
      if (paperChunks.length > 0) {
        const ctxPreview = formatPaperContext(paperChunks)
        console.log(`📚 [${requestId}] 주입 컨텍스트 길이: ${ctxPreview.length}자, 미리보기(200자): ${ctxPreview.slice(0, 200).replace(/\n/g, ' ')}...`)
      }
    }

    const useHaiku = shouldUseHaiku(message)
    const ambiguousHint = detectAmbiguousTerms(message)
    if (ambiguousHint) {
      console.log(`🔀 [${requestId}] 다중 의미 키워드 감지: ${ambiguousHint.terms.map((t) => t.term).join(', ')}, 의료 맥락: ${ambiguousHint.hasMedicalContext}`)
    }
    const systemPrompt = buildSystemPrompt(profile, currentHealthContext, appContext, paperChunks, {
      useHaiku,
      userName,
      ambiguousHint,
      usdaContext,
      foodKnowledgeContext,
      dniCautionGuide,
      drugContext,
      drugQueryMissing,
    })
    const chatMessages: { role: 'user' | 'assistant'; content: string }[] = [
      ...history,
      { role: 'user', content: message },
    ]
    const hasPaperBlock = systemPrompt.includes('학술 논문') && systemPrompt.includes('PMID')
    console.log(`📝 [${requestId}] 시스템 프롬프트: 총 ${systemPrompt.length}자, 논문 블록 포함 여부: ${hasPaperBlock}, 논문 건수: ${paperChunks.length}, 공감 모드: ${useHaiku}, 대화 턴: ${chatMessages.length}`)
    if (paperChunks.length > 0 && !hasPaperBlock) {
      console.warn(`⚠️ [${requestId}] RAG 논문이 있으나 시스템 프롬프트에 논문 블록이 없음 — 주입 실패 가능`)
    }

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

    // JSON 응답: { answer, papers } — 참고 문헌 최대 3개, 답변 하단에만 노출
    const papers = refsForSidebar.slice(0, 3).map((r) => ({
      title: r.title,
      pmid: r.pmid,
      url: r.url,
      journal: r.journal,
      abstract: r.abstract,
    }))
    console.log(`📤 [${requestId}] 응답 전송: answer ${answer.length}자, papers ${papers.length}건(최대 3건)`)
    return NextResponse.json({ answer, papers })
  } catch (error) {
    console.error(`❌ [${requestId}] 예외:`, error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
