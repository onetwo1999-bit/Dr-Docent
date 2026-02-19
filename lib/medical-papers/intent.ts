/**
 * 대화 의도 분류 (Intent Classification)
 * [일상 모드]: 인사, 감정 교류, 일반 정보 → API 미호출
 * [분석 모드]: 증상 분석, 수치 해석, 질병 판단, 치료 결과 예측 → searchPapers 강제 호출
 */

/** 일상 모드: 단순 인사, 감정 교류, 서비스 이용 방법 (API 미호출) */
const DAILY_KEYWORDS = [
  '안녕', 'hello', '하이', '반가워', '좋은 아침', '좋은 저녁',
  '감사', '고마워', '고맙', 'thanks', 'thank',
  '뭐해', '뭐하', '잘 지내', '잘 지냈',
  '이용', '사용법', '사용 방법', '도움', 'help', '도와',
  '소개', '설명', '알려줘',
  '날씨', '기분',
]

/** 분석 모드: [증상 분석, 수치 해석, 질병 판단, 치료 결과 예측] - 법적으로 민감한 결과 도출 */
const ANALYSIS_KEYWORDS = [
  '증상', '통증', '아프', '아파', '아픈', '불편', '해석', '분석',
  '혈당', '혈압', '혈액', '체중', 'bmi', '수치',
  '진단', '질병', '질환', '병', '치료', '예측', '효과', '부작용',
  '약', '수술', '검사', '처방', '원인', '가능성', '위험',
  '두통', '소화', '피로', '무릎', '허리', '관절',
  '당뇨', '고혈압', '저혈압', '콜레스테롤', '대사', '통풍', '췌장',
  '영양', '식단', '다이어트', '운동',
  '논문', '연구', '근거', '데이터', '결과',
]

/** 강제 searchPapers 트리거: 수치, 논문, 연구, 근거, 혈당, BMI 등 — tool_choice 강제 */
const FORCED_SEARCH_KEYWORDS = ['수치', '논문', '연구', '근거', '혈당', 'bmi', 'BMI']

export function isForcedSearchTrigger(message: string): boolean {
  const text = message.trim().toLowerCase()
  return FORCED_SEARCH_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))
}

/**
 * 분석 모드 여부 (searchPapers 강제 호출 트리거)
 * - 증상 분석, 수치 해석, 질병 판단, 치료 결과 예측 등 결과 도출 요구 시 true
 * - 단순 인사, 감정 교류, 서비스 문의는 false (API 미호출)
 */
export function isAnalysisIntent(message: string): boolean {
  const text = message.trim().toLowerCase()
  if (text.length < 2) return false

  const dailyOnly = ['안녕', 'hello', '하이', '감사', '고마워', 'thanks', '날씨', '기분', '잘 지내', '잘 지냈']
  const isPureGreeting = dailyOnly.some((kw) => text === kw || text.startsWith(kw + ' ') || text.endsWith(' ' + kw))

  if (isPureGreeting && text.length < 20) return false

  const analysisMatch = ANALYSIS_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))
  const dailyMatch = DAILY_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))

  if (analysisMatch) return true
  if (isForcedSearchTrigger(message)) return true
  if (dailyMatch && !analysisMatch) return false
  return false
}

/** 음식·영양소 관련 의도: 특정 음식/영양 질문 시 내부 DB + USDA + PubMed 하이브리드 RAG 트리거 */
const FOOD_NUTRIENT_KEYWORDS = [
  '음식', '식품', '식재료', '영양', '성분', '칼로리', '단백질', '지방', '탄수화물', '비타민', '미네랄',
  '레시피', '식단', '메뉴', '저녁', '아침', '점심', '간식', '나트륨', '당', '당류', '섬유', '식이섬유',
  '마그네슘', '칼슘', '칼륨', '철분', '오메가', '포화지방', '콜레스테롤',
]

export function isFoodOrNutrientIntent(message: string): boolean {
  if (!message || message.trim().length < 2) return false
  const text = message.trim().toLowerCase()
  return FOOD_NUTRIENT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))
}

/** 질문에서 식품 검색어 추출 (간단: 한글/영문 단어 1~2개). USDA 검색용. */
export function extractFoodSearchQuery(message: string): string | null {
  const t = message.trim()
  if (t.length < 2) return null
  const removed = t.replace(/(칼로리|영양|성분|얼마|몇|함유|포함|있어|알려|알고|싶어|요\?|있나|있니)/gi, ' ').trim()
  const words = removed.split(/\s+/).filter((w) => w.length >= 1 && /[\u3131-\uD7A3a-zA-Z]/.test(w))
  if (words.length === 0) return null
  return words.slice(0, 3).join(' ')
}

/**
 * 추출된 검색어가 식품 명칭(사과, 고기 등)인지, 증상/형용사인지 구분.
 * 증상·형용사일 경우 USDA API 호출을 건너뛰고 PubMed·내부 DB만 사용.
 */
const NON_FOOD_QUERY_TERMS = new Set([
  // 증상
  '아픈', '아프다', '아파', '통증', '두통', '복통', '어지럽', '어지러움', '피로', '부종', '가려움', '가려운',
  '메스껍', '메스꺼움', '구토', '설사', '변비', '불면', '열', '오한', '저림', '마비', '쑤심', '쑤시', '뻐근', '뻐근함',
  '따가움', '따가워', '욱신', '욱신거림', '저리', '결리', '부었어', '붓기', '멍', '멍울',
  // 형용사·상태
  '맛있는', '맛없는', '짜다', '달다', '싱겁', '느끼한', '건강한', '나쁜', '좋은', '빨간', '빨간색',
  '좋아', '싫어', '싫은', '무거운', '가벼운', '딱딱한', '부드러운', '차가운', '뜨거운',
  // 기타 식품명이 아닌 단어
  '못', '잘', '너무', '많이', '적게', '어떤', '무슨', '이거', '그거', '저거',
])

export function isLikelyFoodName(query: string | null): boolean {
  if (!query || typeof query !== 'string') return false
  const t = query.trim()
  if (t.length < 2) return false
  const lower = t.toLowerCase()
  if (NON_FOOD_QUERY_TERMS.has(t) || NON_FOOD_QUERY_TERMS.has(lower)) return false
  const words = t.split(/\s+/).filter((w) => w.length >= 1)
  if (words.length >= 1 && words.every((w) => NON_FOOD_QUERY_TERMS.has(w) || NON_FOOD_QUERY_TERMS.has(w.toLowerCase())))
    return false
  return true
}
