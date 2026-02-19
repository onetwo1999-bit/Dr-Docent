-- =====================================================
-- 닥터 도슨(Dr. DOCENT) 건강 관리 PWA — 5개 핵심 테이블
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- =====================================================
-- 1️⃣ profiles: 사용자 프로필 (닉네임, 보유 질환)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  diseases JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);


-- =====================================================
-- 2️⃣ vitals: 혈압·혈당 등 신체 지표
-- =====================================================
CREATE TABLE IF NOT EXISTS vitals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value1 DOUBLE PRECISION,
  value2 DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vitals_user_id ON vitals(user_id);
CREATE INDEX IF NOT EXISTS idx_vitals_recorded_at ON vitals(recorded_at);
CREATE INDEX IF NOT EXISTS idx_vitals_type ON vitals(type);

ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vitals" ON vitals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vitals" ON vitals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vitals" ON vitals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vitals" ON vitals
  FOR DELETE USING (auth.uid() = user_id);


-- =====================================================
-- 3️⃣ drug_master: 식약처 API 약물 성분 캐시
-- =====================================================
CREATE TABLE IF NOT EXISTS drug_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  main_ingredient TEXT,
  ingredient_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drug_master_product_name ON drug_master(product_name);
CREATE INDEX IF NOT EXISTS idx_drug_master_main_ingredient ON drug_master(main_ingredient);
CREATE INDEX IF NOT EXISTS idx_drug_master_ingredient_code ON drug_master(ingredient_code);

ALTER TABLE drug_master ENABLE ROW LEVEL SECURITY;
-- 서버(service_role)만 쓰는 캐시 테이블: 정책 없음. 읽기만 앱에서 필요하면 SELECT 정책 추가.


-- =====================================================
-- 4️⃣ user_medications: 유저 복용 약 목록
-- =====================================================
CREATE TABLE IF NOT EXISTS user_medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES drug_master(id) ON DELETE RESTRICT,
  dosage TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_medications_user_id ON user_medications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_medications_drug_id ON user_medications(drug_id);
CREATE INDEX IF NOT EXISTS idx_user_medications_is_active ON user_medications(is_active);

ALTER TABLE user_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own medications" ON user_medications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medications" ON user_medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medications" ON user_medications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own medications" ON user_medications
  FOR DELETE USING (auth.uid() = user_id);


-- =====================================================
-- 5️⃣ dni_logic: 약물 성분 ↔ 주의 영양소 매핑 (Drug–Nutrient Interaction)
-- =====================================================
CREATE TABLE IF NOT EXISTS dni_logic (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_name TEXT NOT NULL,
  target_nutrient TEXT NOT NULL,
  warning_level TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dni_logic_ingredient_name ON dni_logic(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_dni_logic_target_nutrient ON dni_logic(target_nutrient);

ALTER TABLE dni_logic ENABLE ROW LEVEL SECURITY;
-- 참조 데이터: 앱에서 읽기만 하면 되면 SELECT 정책을 허용하거나, 서버만 읽으면 정책 없음.
-- 예: 인증된 사용자 읽기 허용
CREATE POLICY "Authenticated can read dni_logic" ON dni_logic
  FOR SELECT TO authenticated USING (true);


-- =====================================================
-- ✅ 완료. Supabase SQL Editor에서 위 스크립트 실행하세요.
-- =====================================================
