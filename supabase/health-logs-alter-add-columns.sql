-- =====================================================
-- health_logs 컬럼 부족 시 즉시 실행용 ALTER TABLE
-- Supabase SQL Editor에서 이 파일 내용을 붙여넣고 실행하세요.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_logs' AND column_name = 'notes') THEN
    ALTER TABLE health_logs ADD COLUMN notes TEXT;
    RAISE NOTICE 'notes 추가';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_logs' AND column_name = 'intensity_metrics') THEN
    ALTER TABLE health_logs ADD COLUMN intensity_metrics JSONB;
    RAISE NOTICE 'intensity_metrics 추가';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_logs' AND column_name = 'exercise_type') THEN
    ALTER TABLE health_logs ADD COLUMN exercise_type TEXT;
    RAISE NOTICE 'exercise_type 추가';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_logs' AND column_name = 'duration_minutes') THEN
    ALTER TABLE health_logs ADD COLUMN duration_minutes INTEGER;
    RAISE NOTICE 'duration_minutes 추가';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_logs' AND column_name = 'heart_rate') THEN
    ALTER TABLE health_logs ADD COLUMN heart_rate INTEGER;
    RAISE NOTICE 'heart_rate 추가';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_logs' AND column_name = 'meal_description') THEN
    ALTER TABLE health_logs ADD COLUMN meal_description TEXT;
    RAISE NOTICE 'meal_description 추가';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_logs' AND column_name = 'medication_name') THEN
    ALTER TABLE health_logs ADD COLUMN medication_name TEXT;
    RAISE NOTICE 'medication_name 추가';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_logs' AND column_name = 'medication_dosage') THEN
    ALTER TABLE health_logs ADD COLUMN medication_dosage TEXT;
    RAISE NOTICE 'medication_dosage 추가';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_logs' AND column_name = 'medication_ingredients') THEN
    ALTER TABLE health_logs ADD COLUMN medication_ingredients TEXT;
    RAISE NOTICE 'medication_ingredients 추가';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_health_logs_intensity_metrics
  ON health_logs USING GIN(intensity_metrics)
  WHERE intensity_metrics IS NOT NULL;

SELECT 'health_logs 컬럼 추가 완료' AS result;
