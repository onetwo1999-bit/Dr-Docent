-- =====================================================
-- 23502 not_null_violation 해결: time / scheduled_time 컬럼 동기화
-- 에러: null value in column "time" of relation "schedules"
-- Supabase에서 컬럼명이 'time'만 있거나 'scheduled_time'만 있는 경우 둘 다 있도록 맞춤.
-- 실행 후: Settings → API → "Reload schema" 클릭
-- =====================================================

-- 1) scheduled_time 은 있는데 time 이 없으면 → time 컬럼 추가 (scheduled_time 값 복사)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'scheduled_time')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'time') THEN
    ALTER TABLE public.schedules ADD COLUMN time TIME NOT NULL DEFAULT '09:00';
    UPDATE public.schedules SET time = scheduled_time WHERE time IS NULL OR time = '09:00';
  END IF;
END $$;

-- 2) time 은 있는데 scheduled_time 이 없으면 → scheduled_time 컬럼 추가 (time 값 복사)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'time')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'scheduled_time') THEN
    ALTER TABLE public.schedules ADD COLUMN scheduled_time TIME NOT NULL DEFAULT '09:00';
    UPDATE public.schedules SET scheduled_time = time;
  END IF;
END $$;

-- 3) time 컬럼이 있으면 기본값 설정 (새 행용)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'time') THEN
    UPDATE public.schedules SET time = COALESCE(scheduled_time, '09:00'::TIME) WHERE time IS NULL;
    ALTER TABLE public.schedules ALTER COLUMN time SET DEFAULT '09:00';
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
