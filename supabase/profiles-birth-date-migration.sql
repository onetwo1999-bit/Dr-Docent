-- =====================================================
-- profiles: age (integer) → birth_date (date) 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- 1. birth_date 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN birth_date DATE;
    COMMENT ON COLUMN profiles.birth_date IS '생년월일 (나이 자동 계산용)';
  END IF;
END $$;

-- 2. 기존 age 값이 있으면 대략적인 birth_date로 마이그레이션
UPDATE profiles
SET birth_date = (CURRENT_DATE - (age * interval '1 year'))::date
WHERE age IS NOT NULL AND birth_date IS NULL AND age BETWEEN 1 AND 120;

-- 3. age 컬럼 삭제
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'age'
  ) THEN
    ALTER TABLE profiles DROP COLUMN age;
  END IF;
END $$;

SELECT '✅ profiles birth_date 마이그레이션 완료' AS result;
