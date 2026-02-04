-- =====================================================
-- 23502 not_null_violation 해결: days / days_of_week 컬럼 동기화
-- 에러: null value in column "days" of relation "schedules"
-- Supabase에서 컬럼명이 'days'만 있거나 'days_of_week'만 있는 경우 둘 다 있도록 맞춤.
-- 실행 후: Settings → API → "Reload schema" 클릭
-- =====================================================

-- 1) days_of_week 는 있는데 days 가 없으면 → days 컬럼 추가 (days_of_week 값 복사)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days_of_week')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days') THEN
    ALTER TABLE public.schedules ADD COLUMN days INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5];
    UPDATE public.schedules SET days = days_of_week WHERE days IS NULL OR days = ARRAY[1,2,3,4,5];
  END IF;
END $$;

-- 2) days 는 있는데 days_of_week 가 없으면 → days_of_week 컬럼 추가 (days 값 복사)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days_of_week') THEN
    ALTER TABLE public.schedules ADD COLUMN days_of_week INT[] DEFAULT ARRAY[1,2,3,4,5];
    UPDATE public.schedules SET days_of_week = days;
  END IF;
END $$;

-- 3) days 컬럼이 있으면 기본값 설정 (새 행용)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days') THEN
    -- NULL인 경우 기본값으로 업데이트
    UPDATE public.schedules SET days = COALESCE(days_of_week, ARRAY[1,2,3,4,5]) WHERE days IS NULL;
    -- NOT NULL 제약이 없으면 추가
    BEGIN
      ALTER TABLE public.schedules ALTER COLUMN days SET NOT NULL;
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
    -- 기본값 설정
    BEGIN
      ALTER TABLE public.schedules ALTER COLUMN days SET DEFAULT ARRAY[1,2,3,4,5];
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- 4) days_of_week와 days 값 동기화 (둘 다 있는 경우)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days_of_week') THEN
    -- days가 NULL이면 days_of_week 값으로 채움
    UPDATE public.schedules SET days = days_of_week WHERE days IS NULL;
    -- days_of_week가 NULL이면 days 값으로 채움
    UPDATE public.schedules SET days_of_week = days WHERE days_of_week IS NULL;
  END IF;
END $$;
