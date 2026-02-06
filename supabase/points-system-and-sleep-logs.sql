-- =====================================================
-- 2. 포인트 시스템 및 수면 데이터
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- =====================================================
-- 2-1. sleep_logs 테이블 생성
-- =====================================================

CREATE TABLE IF NOT EXISTS sleep_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sleep_duration NUMERIC(4, 2) NOT NULL CHECK (sleep_duration >= 0 AND sleep_duration <= 24),
  quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 10),
  wake_up_time TIME,
  sleep_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, sleep_date) -- 같은 날 중복 기록 방지
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_id ON sleep_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_sleep_date ON sleep_logs(sleep_date);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date ON sleep_logs(user_id, sleep_date);

COMMENT ON TABLE sleep_logs IS '수면 로그: 수면 시간, 품질 점수, 기상 시간 등';
COMMENT ON COLUMN sleep_logs.sleep_duration IS '수면 시간 (시간 단위, 0-24)';
COMMENT ON COLUMN sleep_logs.quality_score IS '수면 품질 점수 (1-10)';
COMMENT ON COLUMN sleep_logs.wake_up_time IS '기상 시간';

-- RLS 활성화
ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sleep_logs' AND policyname = 'Users can view own sleep logs') THEN
    CREATE POLICY "Users can view own sleep logs" ON sleep_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sleep_logs' AND policyname = 'Users can insert own sleep logs') THEN
    CREATE POLICY "Users can insert own sleep logs" ON sleep_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sleep_logs' AND policyname = 'Users can update own sleep logs') THEN
    CREATE POLICY "Users can update own sleep logs" ON sleep_logs FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sleep_logs' AND policyname = 'Users can delete own sleep logs') THEN
    CREATE POLICY "Users can delete own sleep logs" ON sleep_logs FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- =====================================================
-- 2-2. user_points 테이블 생성
-- =====================================================

CREATE TABLE IF NOT EXISTS user_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  daily_points INTEGER NOT NULL DEFAULT 0 CHECK (daily_points >= 0 AND daily_points <= 10),
  annual_points INTEGER NOT NULL DEFAULT 0 CHECK (annual_points >= 0 AND annual_points <= 3650),
  last_updated_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_last_updated_date ON user_points(last_updated_date);

COMMENT ON TABLE user_points IS '사용자 포인트: 일일 최대 10점, 연간 최대 3,650점';
COMMENT ON COLUMN user_points.daily_points IS '오늘 획득한 포인트 (최대 10점)';
COMMENT ON COLUMN user_points.annual_points IS '올해 누적 포인트 (최대 3,650점)';
COMMENT ON COLUMN user_points.last_updated_date IS '마지막 포인트 업데이트 날짜';

-- RLS 활성화
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

-- RLS 정책
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_points' AND policyname = 'Users can view own points') THEN
    CREATE POLICY "Users can view own points" ON user_points FOR SELECT USING (auth.uid() = user_id);
  END IF;
  -- INSERT/UPDATE는 트리거를 통해서만 수행되도록 제한
END $$;

-- =====================================================
-- 2-3. 포인트 계산 함수
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_points_for_activity(
  p_category TEXT,
  p_meal_count INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_category
    WHEN 'exercise' THEN RETURN 3;
    WHEN 'medication' THEN RETURN 2;
    WHEN 'sleep' THEN RETURN 2;
    WHEN 'meal' THEN RETURN LEAST(p_meal_count, 3); -- 일 최대 3점
    ELSE RETURN 0;
  END CASE;
END;
$$;

COMMENT ON FUNCTION calculate_points_for_activity IS '활동별 포인트 계산: 운동 3점, 복약 2점, 수면 2점, 식사 회당 1점 (일 최대 3점)';

-- =====================================================
-- 2-4. 포인트 업데이트 함수 (일일/연간 제한 검증 포함)
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_points(
  p_user_id UUID,
  p_points_to_add INTEGER,
  p_activity_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  success BOOLEAN,
  daily_points INTEGER,
  annual_points INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_daily INTEGER := 0;
  v_current_annual INTEGER := 0;
  v_last_updated DATE;
  v_new_daily INTEGER;
  v_new_annual INTEGER;
  v_points_to_actually_add INTEGER;
BEGIN
  -- 사용자 포인트 레코드 조회 또는 생성
  SELECT daily_points, annual_points, last_updated_date
  INTO v_current_daily, v_current_annual, v_last_updated
  FROM user_points
  WHERE user_id = p_user_id;

  -- 레코드가 없으면 생성
  IF v_current_daily IS NULL THEN
    INSERT INTO user_points (user_id, daily_points, annual_points, last_updated_date)
    VALUES (p_user_id, 0, 0, p_activity_date)
    ON CONFLICT (user_id) DO NOTHING;
    v_current_daily := 0;
    v_current_annual := 0;
    v_last_updated := p_activity_date;
  END IF;

  -- 날짜가 바뀌면 일일 포인트 리셋
  IF v_last_updated < p_activity_date THEN
    v_current_daily := 0;
  END IF;

  -- 일일 제한 검증 (최대 10점)
  v_new_daily := v_current_daily + p_points_to_add;
  IF v_new_daily > 10 THEN
    v_points_to_actually_add := 10 - v_current_daily;
    v_new_daily := 10;
  ELSE
    v_points_to_actually_add := p_points_to_add;
    v_new_daily := v_current_daily + p_points_to_actually_add;
  END IF;

  -- 연간 제한 검증 (최대 3,650점)
  v_new_annual := v_current_annual + v_points_to_actually_add;
  IF v_new_annual > 3650 THEN
    v_points_to_actually_add := 3650 - v_current_annual;
    v_new_annual := 3650;
    v_new_daily := v_current_daily + v_points_to_actually_add;
  END IF;

  -- 포인트 업데이트
  INSERT INTO user_points (user_id, daily_points, annual_points, last_updated_date, updated_at)
  VALUES (p_user_id, v_new_daily, v_new_annual, p_activity_date, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    daily_points = EXCLUDED.daily_points,
    annual_points = EXCLUDED.annual_points,
    last_updated_date = EXCLUDED.last_updated_date,
    updated_at = NOW();

  -- 결과 반환
  RETURN QUERY SELECT
    TRUE,
    v_new_daily,
    v_new_annual,
    CASE
      WHEN v_points_to_actually_add < p_points_to_add THEN
        format('포인트 제한으로 %d점만 추가되었습니다. (일일 최대 10점, 연간 최대 3,650점)', v_points_to_actually_add)
      ELSE
        format('%d점이 추가되었습니다.', v_points_to_actually_add)
    END;
END;
$$;

COMMENT ON FUNCTION update_user_points IS '사용자 포인트 업데이트: 일일/연간 제한 검증 포함';

-- =====================================================
-- 2-5. health_logs INSERT 트리거 (포인트 자동 지급)
-- =====================================================

CREATE OR REPLACE FUNCTION award_points_on_health_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_meal_count INTEGER;
  v_activity_date DATE;
BEGIN
  -- 활동 날짜 추출
  v_activity_date := (NEW.logged_at AT TIME ZONE 'Asia/Seoul')::DATE;

  -- 카테고리별 포인트 계산
  IF NEW.category = 'meal' THEN
    -- 같은 날 식사 기록 개수 확인
    SELECT COUNT(*) INTO v_meal_count
    FROM health_logs
    WHERE user_id = NEW.user_id
      AND category = 'meal'
      AND (logged_at AT TIME ZONE 'Asia/Seoul')::DATE = v_activity_date;
    
    -- 첫 번째 식사 기록이면 1점, 두 번째면 1점 추가, 세 번째면 1점 추가 (최대 3점)
    IF v_meal_count = 1 THEN
      v_points := 1;
    ELSIF v_meal_count = 2 THEN
      v_points := 1;
    ELSIF v_meal_count = 3 THEN
      v_points := 1;
    ELSE
      v_points := 0; -- 3회 초과는 포인트 없음
    END IF;
  ELSE
    -- 운동, 복약, 수면은 각각 1회만 포인트 지급
    -- 같은 날 같은 카테고리 기록이 이미 있는지 확인
    IF EXISTS (
      SELECT 1 FROM health_logs
      WHERE user_id = NEW.user_id
        AND category = NEW.category
        AND (logged_at AT TIME ZONE 'Asia/Seoul')::DATE = v_activity_date
        AND id != NEW.id
    ) THEN
      v_points := 0; -- 이미 기록이 있으면 포인트 없음
    ELSE
      v_points := calculate_points_for_activity(NEW.category, 0);
    END IF;
  END IF;

  -- 포인트 지급 (0점이면 스킵)
  IF v_points > 0 THEN
    PERFORM update_user_points(NEW.user_id, v_points, v_activity_date);
  END IF;

  RETURN NEW;
END;
$$;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_award_points_on_health_log ON health_logs;
CREATE TRIGGER trigger_award_points_on_health_log
  AFTER INSERT ON health_logs
  FOR EACH ROW
  EXECUTE FUNCTION award_points_on_health_log();

-- =====================================================
-- 2-6. sleep_logs INSERT 트리거 (포인트 자동 지급)
-- =====================================================

CREATE OR REPLACE FUNCTION award_points_on_sleep_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_activity_date DATE;
BEGIN
  v_activity_date := NEW.sleep_date;

  -- 같은 날 수면 기록이 이미 있는지 확인
  IF EXISTS (
    SELECT 1 FROM sleep_logs
    WHERE user_id = NEW.user_id
      AND sleep_date = v_activity_date
      AND id != NEW.id
  ) THEN
    v_points := 0; -- 이미 기록이 있으면 포인트 없음
  ELSE
    v_points := 2; -- 수면 기록 2점
  END IF;

  -- 포인트 지급
  IF v_points > 0 THEN
    PERFORM update_user_points(NEW.user_id, v_points, v_activity_date);
  END IF;

  RETURN NEW;
END;
$$;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_award_points_on_sleep_log ON sleep_logs;
CREATE TRIGGER trigger_award_points_on_sleep_log
  AFTER INSERT ON sleep_logs
  FOR EACH ROW
  EXECUTE FUNCTION award_points_on_sleep_log();

-- =====================================================
-- 2-7. 연간 포인트 리셋 함수 (매년 1월 1일 실행용)
-- =====================================================

CREATE OR REPLACE FUNCTION reset_annual_points()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  UPDATE user_points
  SET annual_points = 0,
      last_updated_date = CURRENT_DATE,
      updated_at = NOW()
  WHERE annual_points > 0;

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  RETURN v_reset_count;
END;
$$;

COMMENT ON FUNCTION reset_annual_points IS '연간 포인트 리셋 (매년 1월 1일 실행)';

SELECT '✅ 포인트 시스템 및 수면 로그 테이블 생성 완료' AS result;
