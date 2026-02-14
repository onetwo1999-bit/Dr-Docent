-- =====================================================
-- [Supabase SQL Editor에서 이 파일만 실행하세요]
-- exercises — 닥터 도슨트 운동 전문 지식 DB
-- pgvector 확장 필요: Supabase Dashboard > Extensions > vector 활성화
-- =====================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  korean_name TEXT,
  force TEXT,
  level TEXT,
  mechanic TEXT,
  equipment TEXT,
  primary_muscles JSONB DEFAULT '[]',
  secondary_muscles JSONB DEFAULT '[]',
  instructions JSONB DEFAULT '[]',
  category TEXT,
  biomechanical_rationale TEXT,
  clinical_insight TEXT,
  regression_progression TEXT,
  red_flags TEXT,
  kinetic_chain TEXT,
  time_under_tension TEXT,
  proprioception_tip TEXT,
  anatomical_focus TEXT,
  biomechanical_limit TEXT,
  clinical_contraindication JSONB DEFAULT '[]',
  expert_rationale TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exercises_embedding
  ON exercises USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);
CREATE INDEX IF NOT EXISTS idx_exercises_korean_name ON exercises(korean_name);
CREATE INDEX IF NOT EXISTS idx_exercises_level ON exercises(level);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for authenticated" ON exercises;
CREATE POLICY "Allow read for authenticated" ON exercises
  FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT는 service_role 키로 수행 (RLS 우회). anon 키 사용 시에는 아래 정책 필요:
-- CREATE POLICY "Allow insert" ON exercises FOR INSERT WITH CHECK (true);

-- [기존 exercises 테이블에 물리치료 차트 4컬럼 추가 시]
-- ALTER TABLE exercises ADD COLUMN IF NOT EXISTS anatomical_focus TEXT;
-- ALTER TABLE exercises ADD COLUMN IF NOT EXISTS biomechanical_limit TEXT;
-- ALTER TABLE exercises ADD COLUMN IF NOT EXISTS clinical_contraindication JSONB DEFAULT '[]';
-- ALTER TABLE exercises ADD COLUMN IF NOT EXISTS expert_rationale TEXT;
