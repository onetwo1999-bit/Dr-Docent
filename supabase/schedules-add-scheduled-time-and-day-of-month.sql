-- =====================================================
-- 식단알람 저장 오류 해결: scheduled_time, day_of_month 컬럼 추가
-- 에러: PGRST204 / 42703 (scheduled_time, day_of_month does not exist)
-- Supabase SQL Editor에서 이 파일 전체 실행 후
-- Settings → API → "Reload schema" 클릭
-- =====================================================

-- scheduled_time 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'scheduled_time') THEN
    ALTER TABLE public.schedules ADD COLUMN scheduled_time TIME NOT NULL DEFAULT '09:00';
  END IF;
END $$;

-- day_of_month 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'day_of_month') THEN
    ALTER TABLE public.schedules ADD COLUMN day_of_month INT CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31));
  END IF;
END $$;

-- 인덱스 (없으면 생성)
CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_time ON public.schedules(scheduled_time);
