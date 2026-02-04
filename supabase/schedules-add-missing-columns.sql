-- =====================================================
-- Schedules 테이블 누락 컬럼 추가
-- (42703 / PGRST204: column "category" does not exist 등 발생 시 실행)
-- =====================================================

-- category 컬럼이 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.schedules
    ADD COLUMN category TEXT NOT NULL DEFAULT 'meal'
    CHECK (category IN ('meal', 'exercise', 'medication', 'cycle'));
    COMMENT ON COLUMN public.schedules.category IS '일정 카테고리';
  END IF;
END $$;

-- 나머지 누락 가능 컬럼 추가 (있으면 스킵)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'sub_type') THEN
    ALTER TABLE public.schedules ADD COLUMN sub_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'title') THEN
    ALTER TABLE public.schedules ADD COLUMN title TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'description') THEN
    ALTER TABLE public.schedules ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'frequency') THEN
    ALTER TABLE public.schedules ADD COLUMN frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'once'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'scheduled_time') THEN
    ALTER TABLE public.schedules ADD COLUMN scheduled_time TIME NOT NULL DEFAULT '09:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days_of_week') THEN
    ALTER TABLE public.schedules ADD COLUMN days_of_week INT[] DEFAULT ARRAY[1,2,3,4,5];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'day_of_month') THEN
    ALTER TABLE public.schedules ADD COLUMN day_of_month INT CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'is_active') THEN
    ALTER TABLE public.schedules ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'notification_enabled') THEN
    ALTER TABLE public.schedules ADD COLUMN notification_enabled BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'notification_minutes_before') THEN
    ALTER TABLE public.schedules ADD COLUMN notification_minutes_before INT DEFAULT 0;
  END IF;
END $$;

-- 인덱스 (없으면 생성)
CREATE INDEX IF NOT EXISTS idx_schedules_category ON public.schedules(category);

-- 실행 후: Supabase 대시보드 → Settings → API → "Reload schema" 클릭
