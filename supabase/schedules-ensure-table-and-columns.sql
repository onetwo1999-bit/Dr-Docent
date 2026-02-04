-- =====================================================
-- Schedules 테이블 전체 스키마 보장
-- (PGRST204 / 42703: column "category" does not exist 해결)
-- 1) 테이블이 없으면 전체 생성
-- 2) 테이블이 있으면 누락된 컬럼만 추가
-- 실행 후: Supabase 대시보드 → Settings → API → "Reload schema" 클릭
-- =====================================================

-- 1) 테이블이 없으면 생성 (전체 컬럼 포함)
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'meal' CHECK (category IN ('meal', 'exercise', 'medication', 'cycle')),
  sub_type TEXT,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'once')),
  scheduled_time TIME NOT NULL DEFAULT '09:00',
  days_of_week INT[] DEFAULT ARRAY[1, 2, 3, 4, 5],
  day_of_month INT CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  is_active BOOLEAN DEFAULT true,
  notification_enabled BOOLEAN DEFAULT true,
  notification_minutes_before INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2) 이미 테이블이 있는 경우 누락된 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'category') THEN
    ALTER TABLE public.schedules ADD COLUMN category TEXT NOT NULL DEFAULT 'meal' CHECK (category IN ('meal', 'exercise', 'medication', 'cycle'));
  END IF;
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

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON public.schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_category ON public.schedules(category);
CREATE INDEX IF NOT EXISTS idx_schedules_is_active ON public.schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_time ON public.schedules(scheduled_time);

-- RLS (테이블이 이미 있어도 정책만 없으면 추가)
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'Users can view own schedules') THEN
    CREATE POLICY "Users can view own schedules" ON public.schedules FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'Users can insert own schedules') THEN
    CREATE POLICY "Users can insert own schedules" ON public.schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'Users can update own schedules') THEN
    CREATE POLICY "Users can update own schedules" ON public.schedules FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'Users can delete own schedules') THEN
    CREATE POLICY "Users can delete own schedules" ON public.schedules FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
