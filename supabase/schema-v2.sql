-- =====================================================
-- 📊 닥터 도슨 - 건강 관리 엔진 DB 스키마 (통합 버전)
-- ⚠️ Supabase SQL Editor에서 이 파일 하나만 실행하면 됩니다!
-- =====================================================


-- =====================================================
-- 1️⃣ Health_Logs 테이블 (데일리 건강 기록)
-- =====================================================
CREATE TABLE IF NOT EXISTS health_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('meal', 'exercise', 'medication')),
  logged_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  note TEXT,
  image_url TEXT,
  sub_type TEXT,
  quantity DECIMAL,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_health_logs_user_id ON health_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_logged_at ON health_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_health_logs_category ON health_logs(category);

-- RLS 활성화
ALTER TABLE health_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (이미 존재하면 무시)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_logs' AND policyname = 'Users can view own health logs') THEN
    CREATE POLICY "Users can view own health logs" ON health_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_logs' AND policyname = 'Users can insert own health logs') THEN
    CREATE POLICY "Users can insert own health logs" ON health_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_logs' AND policyname = 'Users can update own health logs') THEN
    CREATE POLICY "Users can update own health logs" ON health_logs FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_logs' AND policyname = 'Users can delete own health logs') THEN
    CREATE POLICY "Users can delete own health logs" ON health_logs FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;


-- =====================================================
-- 2️⃣ Cycle_Logs 테이블 (여성 건강 주기 - '그날' 케어)
-- =====================================================
CREATE TABLE IF NOT EXISTS cycle_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  cycle_length INT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_cycle_logs_user_id ON cycle_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cycle_logs_start_date ON cycle_logs(start_date);

-- RLS 활성화
ALTER TABLE cycle_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cycle_logs' AND policyname = 'Users can view own cycle logs') THEN
    CREATE POLICY "Users can view own cycle logs" ON cycle_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cycle_logs' AND policyname = 'Users can insert own cycle logs') THEN
    CREATE POLICY "Users can insert own cycle logs" ON cycle_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cycle_logs' AND policyname = 'Users can update own cycle logs') THEN
    CREATE POLICY "Users can update own cycle logs" ON cycle_logs FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cycle_logs' AND policyname = 'Users can delete own cycle logs') THEN
    CREATE POLICY "Users can delete own cycle logs" ON cycle_logs FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;


-- =====================================================
-- 3️⃣ Push_Subscriptions 테이블 (푸시 알림 구독 정보)
-- =====================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS 활성화
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS 정책
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Users can view own push subscriptions') THEN
    CREATE POLICY "Users can view own push subscriptions" ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Users can insert own push subscriptions') THEN
    CREATE POLICY "Users can insert own push subscriptions" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Users can update own push subscriptions') THEN
    CREATE POLICY "Users can update own push subscriptions" ON push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Users can delete own push subscriptions') THEN
    CREATE POLICY "Users can delete own push subscriptions" ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;


-- =====================================================
-- 4️⃣ Notification_Settings 테이블 (알림 설정)
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  meal_reminder_enabled BOOLEAN DEFAULT true,
  meal_reminder_times TEXT[] DEFAULT ARRAY['08:00', '12:00', '18:00'],
  medication_reminder_enabled BOOLEAN DEFAULT true,
  medication_reminder_times TEXT[] DEFAULT ARRAY['09:00', '21:00'],
  exercise_reminder_enabled BOOLEAN DEFAULT true,
  exercise_reminder_time TEXT DEFAULT '18:00',
  cycle_reminder_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS 활성화
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS 정책
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_settings' AND policyname = 'Users can view own notification settings') THEN
    CREATE POLICY "Users can view own notification settings" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_settings' AND policyname = 'Users can insert own notification settings') THEN
    CREATE POLICY "Users can insert own notification settings" ON notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_settings' AND policyname = 'Users can update own notification settings') THEN
    CREATE POLICY "Users can update own notification settings" ON notification_settings FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;


-- =====================================================
-- 5️⃣ Schedules 테이블 (반복 일정 관리)
-- =====================================================
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('meal', 'exercise', 'medication', 'cycle')),
  sub_type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'once')) DEFAULT 'daily',
  scheduled_time TIME NOT NULL,
  days_of_week INT[] DEFAULT ARRAY[1, 2, 3, 4, 5],
  day_of_month INT CHECK (day_of_month >= 1 AND day_of_month <= 31),
  is_active BOOLEAN DEFAULT true,
  notification_enabled BOOLEAN DEFAULT true,
  notification_minutes_before INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_category ON schedules(category);
CREATE INDEX IF NOT EXISTS idx_schedules_is_active ON schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_time ON schedules(scheduled_time);

-- RLS 활성화
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- RLS 정책
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'Users can view own schedules') THEN
    CREATE POLICY "Users can view own schedules" ON schedules FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'Users can insert own schedules') THEN
    CREATE POLICY "Users can insert own schedules" ON schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'Users can update own schedules') THEN
    CREATE POLICY "Users can update own schedules" ON schedules FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'Users can delete own schedules') THEN
    CREATE POLICY "Users can delete own schedules" ON schedules FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;


-- =====================================================
-- 6️⃣ Health_Logs에 schedule_id 컬럼 추가 (외래키)
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'health_logs' AND column_name = 'schedule_id') THEN
    ALTER TABLE health_logs ADD COLUMN schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL;
  END IF;
END $$;


-- =====================================================
-- 7️⃣ 캘린더 뷰용 함수 (특정 기간의 기록 조회)
-- =====================================================
CREATE OR REPLACE FUNCTION get_calendar_data(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  log_date DATE,
  category TEXT,
  log_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(logged_at) as log_date,
    health_logs.category,
    COUNT(*) as log_count
  FROM health_logs
  WHERE user_id = p_user_id
    AND DATE(logged_at) BETWEEN p_start_date AND p_end_date
  GROUP BY DATE(logged_at), health_logs.category
  ORDER BY log_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 8️⃣ 오늘의 스케줄 조회 함수
-- =====================================================
CREATE OR REPLACE FUNCTION get_today_schedules(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  category TEXT,
  sub_type TEXT,
  title TEXT,
  scheduled_time TIME,
  is_completed BOOLEAN
) AS $$
DECLARE
  today_dow INT;
BEGIN
  today_dow := EXTRACT(DOW FROM CURRENT_DATE);
  
  RETURN QUERY
  SELECT 
    s.id,
    s.category,
    s.sub_type,
    s.title,
    s.scheduled_time,
    EXISTS (
      SELECT 1 FROM health_logs h 
      WHERE h.user_id = p_user_id 
        AND h.schedule_id = s.id 
        AND DATE(h.logged_at) = CURRENT_DATE
    ) as is_completed
  FROM schedules s
  WHERE s.user_id = p_user_id
    AND s.is_active = true
    AND (
      s.frequency = 'daily'
      OR (s.frequency = 'weekly' AND today_dow = ANY(s.days_of_week))
      OR (s.frequency = 'monthly' AND s.day_of_month = EXTRACT(DAY FROM CURRENT_DATE))
    )
  ORDER BY s.scheduled_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- ✅ 완료! 모든 테이블과 정책이 생성되었습니다.
-- =====================================================
