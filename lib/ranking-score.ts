/** 일일 배점 (하루 최대 10점 캡) */
export const POINTS_EXERCISE = 3
export const POINTS_MEAL_PER = 1
export const POINTS_MEAL_CAP = 3
export const POINTS_MEDICATION = 2
export const POINTS_SLEEP = 2
export const DAILY_SCORE_CAP = 10

/** 해당 날짜의 일일 점수: 운동 3 / 식사 회당 1(일 최대 3) / 복약 2 / 수면 2, 일일 최대 10점 */
export function computeDailyScore(params: {
  mealCount: number
  hasExercise: boolean
  hasMedication: boolean
  hasSleep: boolean
}): number {
  const { mealCount, hasExercise, hasMedication, hasSleep } = params
  const mealPoints = Math.min(mealCount, POINTS_MEAL_CAP) * POINTS_MEAL_PER
  const exercisePoints = hasExercise ? POINTS_EXERCISE : 0
  const medicationPoints = hasMedication ? POINTS_MEDICATION : 0
  const sleepPoints = hasSleep ? POINTS_SLEEP : 0
  const raw = mealPoints + exercisePoints + medicationPoints + sleepPoints
  return Math.min(raw, DAILY_SCORE_CAP)
}
