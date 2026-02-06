-- =====================================================
-- 📊 Profiles 테이블에 chart_number, nickname 추가
-- 랭킹 API에서 차트 번호·닉네임 노출용 (개인정보 보호: 차트 번호는 일부만 노출)
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'chart_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN chart_number TEXT;
    RAISE NOTICE '✅ chart_number 컬럼 추가 완료';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'nickname'
  ) THEN
    ALTER TABLE profiles ADD COLUMN nickname TEXT;
    RAISE NOTICE '✅ nickname 컬럼 추가 완료';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_chart_number ON profiles(chart_number) WHERE chart_number IS NOT NULL;
COMMENT ON COLUMN profiles.chart_number IS '고유 차트 번호 (예: D76850), 랭킹/추천 등에서 사용';
COMMENT ON COLUMN profiles.nickname IS '랭킹 등에 노출되는 닉네임';

SELECT '✅ profiles에 chart_number, nickname 컬럼이 반영되었습니다.' AS result;
