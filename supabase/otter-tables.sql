-- =====================================================
-- 수달 키우기 + 문진표 발급 MVP 테이블
-- Supabase SQL Editor에서 실행하세요
-- =====================================================


-- =====================================================
-- 1. otter_pets: 수달 기본 정보 (유저당 1개)
-- 상태값은 저장하지 않음 — health_logs에서 실시간 계산
-- =====================================================
CREATE TABLE IF NOT EXISTS public.otter_pets (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '도달이',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.otter_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own otter" ON public.otter_pets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own otter" ON public.otter_pets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own otter" ON public.otter_pets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own otter" ON public.otter_pets
  FOR DELETE USING (auth.uid() = user_id);


-- =====================================================
-- 2. otter_reactions: GPT-4o mini 반응 텍스트 캐시
-- 같은 날 같은 액션 타입은 1회만 생성 (UNIQUE 제약)
-- action_type: 'feed' | 'walk' | 'sleep' | 'supplement'
-- =====================================================
CREATE TABLE IF NOT EXISTS public.otter_reactions (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type     TEXT NOT NULL CHECK (action_type IN ('feed', 'walk', 'sleep', 'supplement')),
  reaction_text   TEXT NOT NULL,
  health_log_id   UUID,  -- 연동된 health_logs.id (nullable: sleep_logs 연동 시 NULL 가능)
  reacted_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, action_type, reacted_date)
);

CREATE INDEX IF NOT EXISTS idx_otter_reactions_user_date
  ON public.otter_reactions (user_id, reacted_date DESC);

ALTER TABLE public.otter_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own otter reactions" ON public.otter_reactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own otter reactions" ON public.otter_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own otter reactions" ON public.otter_reactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own otter reactions" ON public.otter_reactions
  FOR DELETE USING (auth.uid() = user_id);


-- =====================================================
-- 3. medical_questionnaires: 문진표 발급 이력
-- Claude Sonnet이 누적 기록을 정리한 결과물 저장
-- =====================================================
CREATE TABLE IF NOT EXISTS public.medical_questionnaires (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_purpose  TEXT,                  -- 예: "내과 외래", "건강검진" (nullable: 미지정 가능)
  content        TEXT NOT NULL,         -- Claude가 생성한 문진표 전문 (마크다운)
  summary_json   JSONB,                 -- 구조화된 핵심 데이터 (약물/질환/최근기록 등)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_questionnaires_user_id
  ON public.medical_questionnaires (user_id, created_at DESC);

ALTER TABLE public.medical_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own questionnaires" ON public.medical_questionnaires
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own questionnaires" ON public.medical_questionnaires
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own questionnaires" ON public.medical_questionnaires
  FOR DELETE USING (auth.uid() = user_id);

-- 문진표는 수정 불가 (생성/삭제만 허용 — 무결성 보장)


SELECT '수달 테이블 3개 생성 완료' AS result;
