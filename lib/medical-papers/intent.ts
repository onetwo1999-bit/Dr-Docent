/**
 * 대화 의도 분류 (Intent Classification)
 * [일상 모드] vs [분석 모드]
 */

/** 일상 모드 키워드: 인사, 감정 교류, 서비스 이용 방법 */
const DAILY_KEYWORDS = [
  '안녕', 'hello', '하이', '반가워', '좋은 아침', '좋은 저녁',
  '감사', '고마워', '고맙', 'thanks', 'thank',
  '어떻게', '뭐해', '뭐하', '무슨', '어디',
  '이용', '사용법', '사용 방법', '도움', 'help', '도와',
  '소개', '설명', '알려', '알려줘',
  '오늘', '날씨', '기분', '잘 지내', '잘 지냈',
]

/** 분석 모드 키워드: 증상, 수치, 판단/결과 요청 */
const ANALYSIS_KEYWORDS = [
  '증상', '통증', '아프', '아파', '아픈', '불편',
  '혈당', '혈압', '혈액', '체중', 'bmi', '수치',
  '진단', '질병', '질환', '병', '치료',
  '약', '수술', '검사', '처방',
  '분석', '결과', '원인', '가능성', '위험',
  '두통', '소화', '피로', '무릎', '허리', '관절',
  '당뇨', '고혈압', '저혈압', '콜레스테롤',
  '영양', '식단', '다이어트', '운동',
  '논문', '연구', '근거', '데이터',
]

/**
 * 분석 모드 여부
 * - 판단·결과 도출을 요하는 회색지대에 놓였을 때 true
 * - 인사, 감정 교류, 서비스 문의는 false
 */
export function isAnalysisIntent(message: string): boolean {
  const text = message.trim().toLowerCase()
  if (text.length < 2) return false

  const dailyMatch = DAILY_KEYWORDS.some((kw) =>
    text.includes(kw.toLowerCase())
  )
  const analysisMatch = ANALYSIS_KEYWORDS.some((kw) =>
    text.includes(kw.toLowerCase())
  )

  if (analysisMatch && !dailyMatch) return true
  if (dailyMatch && !analysisMatch) return false
  if (analysisMatch && dailyMatch) return true
  return false
}
