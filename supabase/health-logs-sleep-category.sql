-- =====================================================
-- health_logs: 수면(sleep) 카테고리 및 sleep_duration_hours 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- 1) sleep_duration_hours 컬럼 추가 (수면 시간, 숫자)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_logs' AND column_name = 'sleep_duration_hours'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN sleep_duration_hours NUMERIC(4, 2);
    RAISE NOTICE 'sleep_duration_hours 컬럼 추가 완료';
  END IF;
END $$;

-- 2) category에 'sleep' 허용 (기존 CHECK가 있으면 제거 후 재생성)
ALTER TABLE health_logs DROP CONSTRAINT IF EXISTS health_logs_category_check;
ALTER TABLE health_logs ADD CONSTRAINT health_logs_category_check
  CHECK (category IN ('meal', 'exercise', 'medication', 'sleep'));

-- 3) RLS 정책은 user_id 기준이므로 category 추가만으로 동일하게 적용됨 (변경 불필요)
-- 기존: "Users can view own health logs" 등 auth.uid() = user_id

CREATE INDEX IF NOT EXISTS idx_health_logs_sleep_duration
  ON health_logs(sleep_duration_hours) WHERE sleep_duration_hours IS NOT NULL;

COMMENT ON COLUMN health_logs.sleep_duration_hours IS '수면 시간(시간 단위). category=sleep일 때 사용';

SELECT 'health_logs 수면(sleep) 카테고리 및 sleep_duration_hours 추가 완료' AS result;
