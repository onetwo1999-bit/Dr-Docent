-- =====================================================
-- 1. heart_rate 컬럼 추가 및 schedules 테이블 충돌 해결
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- =====================================================
-- 1-1. health_logs 테이블에 heart_rate 컬럼 추가
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'health_logs' AND column_name = 'heart_rate'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN heart_rate INTEGER;
    RAISE NOTICE '✅ heart_rate 컬럼 추가 완료';
  ELSE
    RAISE NOTICE 'ℹ️ heart_rate 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- 인덱스 생성 (심박수 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_health_logs_heart_rate ON health_logs(heart_rate) WHERE heart_rate IS NOT NULL;

COMMENT ON COLUMN health_logs.heart_rate IS '운동 시 심박수 (bpm). exercise 카테고리에서 사용';

-- =====================================================
-- 1-2. schedules 테이블 days/days_of_week 충돌 해결
-- =====================================================

-- 전략: days_of_week를 메인으로 사용하고, days는 제거하거나 동기화

DO $$
BEGIN
  -- days_of_week가 없으면 생성
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days_of_week'
  ) THEN
    -- days가 있으면 days 값을 복사하여 days_of_week 생성
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days'
    ) THEN
      ALTER TABLE schedules ADD COLUMN days_of_week INT[] DEFAULT ARRAY[1,2,3,4,5];
      UPDATE schedules SET days_of_week = days WHERE days IS NOT NULL;
      RAISE NOTICE '✅ days_of_week 컬럼 생성 및 days 값 복사 완료';
    ELSE
      -- days도 없으면 기본값으로 생성
      ALTER TABLE schedules ADD COLUMN days_of_week INT[] DEFAULT ARRAY[1,2,3,4,5];
      RAISE NOTICE '✅ days_of_week 컬럼 생성 완료 (기본값)';
    END IF;
  END IF;

  -- days 컬럼이 있으면 NOT NULL 제약 제거 후 동기화 트리거 설정
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days'
  ) THEN
    -- NOT NULL 제약 제거 (있으면)
    BEGIN
      ALTER TABLE schedules ALTER COLUMN days DROP NOT NULL;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'days 컬럼의 NOT NULL 제약이 없거나 이미 제거되었습니다.';
    END;

    -- NULL 값 처리
    UPDATE schedules SET days = days_of_week WHERE days IS NULL AND days_of_week IS NOT NULL;
    UPDATE schedules SET days_of_week = days WHERE days_of_week IS NULL AND days IS NOT NULL;
    
    RAISE NOTICE '✅ days와 days_of_week 동기화 완료';
  END IF;
END $$;

-- 동기화 트리거 함수 생성 (days_of_week 변경 시 days도 자동 업데이트)
CREATE OR REPLACE FUNCTION sync_schedules_days()
RETURNS TRIGGER AS $$
BEGIN
  -- days_of_week가 변경되면 days도 업데이트
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.days_of_week IS NOT NULL THEN
      NEW.days := NEW.days_of_week;
    ELSIF NEW.days IS NOT NULL AND NEW.days_of_week IS NULL THEN
      NEW.days_of_week := NEW.days;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS trigger_sync_schedules_days ON schedules;
CREATE TRIGGER trigger_sync_schedules_days
  BEFORE INSERT OR UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION sync_schedules_days();

-- 기본값 설정 (새 행 삽입 시)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'days_of_week'
  ) THEN
    -- 기본값이 없으면 설정
    ALTER TABLE schedules ALTER COLUMN days_of_week SET DEFAULT ARRAY[1,2,3,4,5];
  END IF;
END $$;

SELECT '✅ heart_rate 컬럼 추가 및 schedules 충돌 해결 완료' AS result;
