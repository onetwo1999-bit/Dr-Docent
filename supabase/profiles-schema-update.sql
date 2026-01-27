-- =====================================================
-- 📊 Profiles 테이블 컬럼 추가 (chronic_diseases, medications, bmi)
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- profiles 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age INT,
  gender TEXT,
  height NUMERIC,
  weight NUMERIC,
  conditions TEXT,
  medications TEXT,
  chronic_diseases TEXT,
  bmi NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 컬럼 추가 (이미 존재하면 무시)
DO $$ 
BEGIN
  -- chronic_diseases 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'chronic_diseases'
  ) THEN
    ALTER TABLE profiles ADD COLUMN chronic_diseases TEXT;
    RAISE NOTICE '✅ chronic_diseases 컬럼 추가 완료';
  END IF;
  
  -- medications 컬럼 추가 (이미 있으면 무시)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'medications'
  ) THEN
    ALTER TABLE profiles ADD COLUMN medications TEXT;
    RAISE NOTICE '✅ medications 컬럼 추가 완료';
  END IF;
  
  -- bmi 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'bmi'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bmi NUMERIC(5, 2);
    RAISE NOTICE '✅ bmi 컬럼 추가 완료';
  END IF;
  
  -- conditions 컬럼이 없으면 추가 (호환성)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'conditions'
  ) THEN
    ALTER TABLE profiles ADD COLUMN conditions TEXT;
    RAISE NOTICE '✅ conditions 컬럼 추가 완료';
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_bmi ON profiles(bmi);

-- RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성/업데이트
DO $$ 
BEGIN
  -- SELECT 정책
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON profiles 
      FOR SELECT USING (auth.uid() = id);
  END IF;
  
  -- INSERT 정책
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON profiles 
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  
  -- UPDATE 정책
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON profiles 
      FOR UPDATE USING (auth.uid() = id);
  END IF;
  
  -- DELETE 정책
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can delete own profile') THEN
    CREATE POLICY "Users can delete own profile" ON profiles 
      FOR DELETE USING (auth.uid() = id);
  END IF;
END $$;

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- 완료!
SELECT '✅ profiles 테이블이 성공적으로 업데이트되었습니다!' AS result;
