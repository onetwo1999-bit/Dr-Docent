-- =====================================================
-- 📊 닥터 도슨 - 건강 관리 엔진 DB 스키마
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- =====================================================
-- 1️⃣ Health_Logs 테이블 (데일리 건강 기록)
-- =====================================================
CREATE TABLE IF NOT EXISTS health_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('meal', 'exercise', 'medication')),
  logged_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  note TEXT, -- 선택적 메모
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_health_logs_user_id ON health_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_logged_at ON health_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_health_logs_category ON health_logs(category);

-- RLS 활성화
ALTER TABLE health_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 데이터만 조회/삽입/수정/삭제 가능
CREATE POLICY "Users can view own health logs" ON health_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health logs" ON health_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health logs" ON health_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own health logs" ON health_logs
  FOR DELETE USING (auth.uid() = user_id);


-- =====================================================
-- 2️⃣ Cycle_Logs 테이블 (여성 건강 주기 - '그날' 케어)
-- =====================================================
CREATE TABLE IF NOT EXISTS cycle_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL, -- 그날 시작일
  end_date DATE, -- 그날 종료일 (선택)
  cycle_length INT, -- 이번 주기 길이 (일수, 자동 계산)
  note TEXT, -- 선택적 메모 (증상, 컨디션 등)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_cycle_logs_user_id ON cycle_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cycle_logs_start_date ON cycle_logs(start_date);

-- RLS 활성화
ALTER TABLE cycle_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own cycle logs" ON cycle_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cycle logs" ON cycle_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cycle logs" ON cycle_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cycle logs" ON cycle_logs
  FOR DELETE USING (auth.uid() = user_id);


-- =====================================================
-- 3️⃣ Push_Subscriptions 테이블 (푸시 알림 구독 정보)
-- =====================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL, -- 암호화 키
  auth TEXT NOT NULL, -- 인증 토큰
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS 활성화
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own push subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);


-- =====================================================
-- 4️⃣ Notification_Settings 테이블 (알림 설정)
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  meal_reminder_enabled BOOLEAN DEFAULT true,
  meal_reminder_times TEXT[] DEFAULT ARRAY['08:00', '12:00', '18:00'], -- 식사 알림 시간
  medication_reminder_enabled BOOLEAN DEFAULT true,
  medication_reminder_times TEXT[] DEFAULT ARRAY['09:00', '21:00'], -- 복약 알림 시간
  exercise_reminder_enabled BOOLEAN DEFAULT true,
  exercise_reminder_time TEXT DEFAULT '18:00', -- 운동 알림 시간
  cycle_reminder_enabled BOOLEAN DEFAULT true, -- 그날 케어 알림
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS 활성화
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own notification settings" ON notification_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings" ON notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings" ON notification_settings
  FOR UPDATE USING (auth.uid() = user_id);


-- =====================================================
-- 5️⃣ 기존 Profiles 테이블에 성별 컬럼 추가 (이미 있으면 무시)
-- =====================================================
-- 이 쿼리는 profiles 테이블에 gender 컬럼이 없을 경우에만 실행
-- DO $$ 
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
--                  WHERE table_name = 'profiles' AND column_name = 'gender') THEN
--     ALTER TABLE profiles ADD COLUMN gender TEXT;
--   END IF;
-- END $$;


-- =====================================================
-- ✅ 완료! 위 SQL을 Supabase SQL Editor에 복사하여 실행하세요.
-- =====================================================
