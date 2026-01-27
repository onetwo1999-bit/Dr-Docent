-- =====================================================
-- 📊 Health_Logs 테이블 스키마 확장
-- 고정밀 건강 기록을 위한 컬럼 추가
-- =====================================================

-- 기존 health_logs 테이블에 추가 컬럼 생성
DO $$ 
BEGIN
  -- notes 컬럼 추가 (상세 메모, note보다 더 긴 텍스트용)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_logs' AND column_name = 'notes'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN notes TEXT;
    RAISE NOTICE '✅ notes 컬럼 추가 완료';
  END IF;
  
  -- intensity_metrics 컬럼 추가 (JSONB - 운동 강도 지표 저장용)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_logs' AND column_name = 'intensity_metrics'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN intensity_metrics JSONB;
    RAISE NOTICE '✅ intensity_metrics 컬럼 추가 완료';
  END IF;
  
  -- exercise_type 컬럼 추가 (운동 종류: 유산소, 웨이트, 걷기 등)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_logs' AND column_name = 'exercise_type'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN exercise_type TEXT;
    RAISE NOTICE '✅ exercise_type 컬럼 추가 완료';
  END IF;
  
  -- duration_minutes 컬럼 추가 (운동 시간 - 분 단위)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_logs' AND column_name = 'duration_minutes'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN duration_minutes INTEGER;
    RAISE NOTICE '✅ duration_minutes 컬럼 추가 완료';
  END IF;
  
  -- heart_rate 컬럼 추가 (심박수)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_logs' AND column_name = 'heart_rate'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN heart_rate INTEGER;
    RAISE NOTICE '✅ heart_rate 컬럼 추가 완료';
  END IF;
  
  -- medication_name 컬럼 추가 (약 이름)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_logs' AND column_name = 'medication_name'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN medication_name TEXT;
    RAISE NOTICE '✅ medication_name 컬럼 추가 완료';
  END IF;
  
  -- medication_dosage 컬럼 추가 (약 용량 - mg 단위)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_logs' AND column_name = 'medication_dosage'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN medication_dosage TEXT;
    RAISE NOTICE '✅ medication_dosage 컬럼 추가 완료';
  END IF;
  
  -- medication_ingredients 컬럼 추가 (주요 성분)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_logs' AND column_name = 'medication_ingredients'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN medication_ingredients TEXT;
    RAISE NOTICE '✅ medication_ingredients 컬럼 추가 완료';
  END IF;
  
  -- meal_description 컬럼 추가 (식사 상세 설명)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_logs' AND column_name = 'meal_description'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN meal_description TEXT;
    RAISE NOTICE '✅ meal_description 컬럼 추가 완료';
  END IF;
  
  -- image_url이 이미 있지만, 명시적으로 확인
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_logs' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE health_logs ADD COLUMN image_url TEXT;
    RAISE NOTICE '✅ image_url 컬럼 추가 완료';
  END IF;
END $$;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_health_logs_exercise_type ON health_logs(exercise_type) WHERE exercise_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_health_logs_intensity_metrics ON health_logs USING GIN(intensity_metrics) WHERE intensity_metrics IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_health_logs_medication_name ON health_logs(medication_name) WHERE medication_name IS NOT NULL;

-- 완료 메시지
SELECT '✅ health_logs 테이블 스키마 확장이 완료되었습니다!' AS result;

-- =====================================================
-- 📝 컬럼 설명
-- =====================================================
-- notes: 상세 메모 (식사 내용, 운동 후기 등)
-- intensity_metrics: JSONB 형식으로 운동 강도 지표 저장
--   예: {"calories_burned": 300, "intensity_level": "high", "avg_heart_rate": 150}
-- exercise_type: 운동 종류 (cardio, weight, walking, pilates, yoga 등)
-- duration_minutes: 운동 시간 (분)
-- heart_rate: 평균 심박수
-- medication_name: 약 이름
-- medication_dosage: 약 용량 (예: "1000mg")
-- medication_ingredients: 주요 성분
-- meal_description: 식사 상세 설명
-- image_url: 식단 사진 URL (Supabase Storage)
