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

// ─────────────────────────────────────────────────────────────────────────────
// 의약품 조회 의도 감지 (MFDS 식약처 API 호출 트리거)
// ─────────────────────────────────────────────────────────────────────────────

/** 자주 검색되는 의약품명 패턴 (소문자로 비교) */
const DRUG_NAME_PATTERNS = [
  // 해열·진통제
  '타이레놀', '아스피린', '이부프로펜', '나프록센', '아세트아미노펜', '애드빌', '부루펜',
  // 항생제
  '아목시실린', '아목시클라브', '세파드록실', '독시사이클린', '레보플록사신', '시프로플록사신',
  // 혈압·심혈관
  '암로디핀', '리시노프릴', '에날라프릴', '발사르탄', '노바스크', '아달라트',
  // 고지혈증
  '로수바스타틴', '아토르바스타틴', '심바스타틴', '리피토', '크레스토',
  // 당뇨
  '메트포르민', '메트포민', '글루코파지', '시타글립틴', '자누비아', '엠파글리플로진',
  '자디앙', '다파글리플로진', '포시가',
  // 위·소화기
  '오메프라졸', '판토프라졸', '란소프라졸', '라베프라졸', '넥시움', '에소메프라졸',
  '파모티딘', '라니티딘', '알비스',
  // 통풍
  '콜킨', '알로푸리놀', '페북스타트', '울로릭', '자일로릭',
  // 항응고·항혈소판
  '클로피도그렐', '플라빅스', '와파린', '리바록사반', '자렐토',
  // 호흡기·알레르기
  '세티리진', '로라타딘', '페시로', '지르텍', '클라리틴',
  '암브록솔', '브롬헥신', '덱스트로메토르판',
  // 신경·정신
  '가바펜틴', '프레가발린', '리리카', '트라마돌',
  '졸피뎀', '알프라졸람', '로라제팜',
  '플루옥세틴', '에스시탈로프람', '설트랄린', '파록세틴',
  // 스테로이드
  '프레드니솔론', '덱사메타손', '메틸프레드니솔론',
  // 기타 OTC
  '판콜', '판피린', '베아제', '훼스탈', '인사돌', '레이델', '우루사',
]

/** 약물 정보 요청 키워드 */
const DRUG_INFO_KEYWORDS = [
  '복용법', '용법', '용량', '먹는법', '먹어도 되', '먹으면',
  '부작용', '이상반응', '효능', '효과', '성분', '주성분',
  '주의사항', '상호작용', '금기', '처방',
  '의약품 정보', '약품명', '일반의약품', '처방약',
]

/**
 * 사용자 질문이 특정 의약품 정보 조회인지 감지.
 * → true면 MFDS e약은요 API를 통해 식약처 실시간 데이터를 가져옴.
 */
export function isDrugIntent(message: string): boolean {
  if (!message || message.trim().length < 2) return false
  const lower = message.toLowerCase()
  // 알려진 약명이 포함된 경우
  if (DRUG_NAME_PATTERNS.some((name) => lower.includes(name.toLowerCase()))) return true
  // 약 관련 키워드 + '약' 단어가 함께 있는 경우
  const hasDrugKeyword = DRUG_INFO_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
  const hasGenericDrug = lower.includes('약') || lower.includes('의약품') || lower.includes('약물')
  return hasDrugKeyword && hasGenericDrug
}

/**
 * 질문에서 의약품 검색어(제품명)를 추출.
 * 알려진 약명 패턴 우선, 없으면 명사 추출.
 */
export function extractDrugSearchQuery(message: string): string | null {
  if (!message || message.trim().length < 2) return null
  const lower = message.toLowerCase()
  // 알려진 약명 우선 매칭
  for (const name of DRUG_NAME_PATTERNS) {
    if (lower.includes(name.toLowerCase())) return name
  }
  // 약 관련 동사·조사 제거 후 명사 추출
  const cleaned = message
    .replace(/(복용법|용법|용량|먹는법|먹어도|먹으면|부작용|효능|효과|성분|주의사항|상호작용|의약품|처방약|일반의약품|알려줘|알려|줘|있나|있어|어떻게|어때|어떤|뭐야|뭔가요|인가요|인지|되나|되요|되나요|입니다|입니까|이에요|이야|이야\?)/gi, ' ')
    .trim()
  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length >= 2 && /[\u3131-\uD7A3a-zA-Z]/.test(w))
  return words.length > 0 ? words.slice(0, 2).join(' ') : null
}

// ─────────────────────────────────────────────────────────────────────────────

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
