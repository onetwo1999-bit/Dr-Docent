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
  if (dailyMatch && !analysisMatch) return false
  return false
}
