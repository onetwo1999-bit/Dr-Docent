-- =====================================================
-- 📊 추천(referrals), 그룹(user_groups), 건강점수(health_scores) 테이블
-- Supabase SQL Editor에서 실행하세요.
-- 모든 식별자는 고유 차트 번호(D76850 형식: 영문 1자 + 숫자 5자)와 매핑됩니다.
-- =====================================================

-- 차트 번호 형식 검증용 정규식 (영문 1자 + 숫자 5자, 예: D76850)
-- 필요 시 아래 CHECK 제약에서 사용

-- =====================================================
-- 1️⃣ referrals (추천인 코드)
-- =====================================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code TEXT NOT NULL UNIQUE,
  creator_chart_number TEXT NOT NULL,
  discount_rate INTEGER NOT NULL CHECK (discount_rate >= 30 AND discount_rate <= 50),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE referrals IS '추천인 코드: 코드 생성자(차트번호), 할인율(30~50%), 만료일(발급일로부터 3개월 권장)';
COMMENT ON COLUMN referrals.referral_code IS '사용자가 입력하는 추천 코드';
COMMENT ON COLUMN referrals.creator_chart_number IS '코드를 생성한 사용자의 고유 차트 번호 (예: D76850)';
COMMENT ON COLUMN referrals.discount_rate IS '할인율 (%) 30~50';
COMMENT ON COLUMN referrals.expires_at IS '코드 만료일 (발급 시 생성일 + 3개월 권장)';

CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_creator_chart_number ON referrals(creator_chart_number);
CREATE INDEX IF NOT EXISTS idx_referrals_expires_at ON referrals(expires_at);

-- RLS 활성화 (필요 시 정책 추가)
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- 기본 정책: 인증된 사용자만 조회 가능 (차트 번호 매핑은 앱 레이어에서 처리)
CREATE POLICY "Allow read referrals for authenticated" ON referrals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert referrals for authenticated" ON referrals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update referrals for authenticated" ON referrals
  FOR UPDATE TO authenticated USING (true);


-- =====================================================
-- 2️⃣ user_groups (그룹)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id TEXT NOT NULL UNIQUE,
  member_chart_numbers TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE user_groups IS '그룹: 그룹 ID, 그룹원 차트 번호 목록, 생성일';
COMMENT ON COLUMN user_groups.group_id IS '그룹 고유 식별자';
COMMENT ON COLUMN user_groups.member_chart_numbers IS '그룹원 고유 차트 번호 배열 (예: {D76850, A12345})';

CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_created_at ON user_groups(created_at);
-- 배열 내 특정 차트 번호 검색용 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_user_groups_member_chart_numbers ON user_groups USING GIN (member_chart_numbers);

ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read user_groups for authenticated" ON user_groups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert user_groups for authenticated" ON user_groups
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update user_groups for authenticated" ON user_groups
  FOR UPDATE TO authenticated USING (true);


-- =====================================================
-- 3️⃣ health_scores (유료 구독자 실시간 랭킹용 일일 점수)
-- =====================================================
CREATE TABLE IF NOT EXISTS health_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chart_number TEXT NOT NULL,
  score_date DATE NOT NULL,
  score NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (chart_number, score_date)
);

COMMENT ON TABLE health_scores IS '유료 구독자 실시간 랭킹용: 일별 건강 점수 (차트 번호 기준)';
COMMENT ON COLUMN health_scores.chart_number IS '사용자 고유 차트 번호 (예: D76850)';
COMMENT ON COLUMN health_scores.score_date IS '점수 기준일';
COMMENT ON COLUMN health_scores.score IS '해당 일의 종합 건강 점수';

CREATE INDEX IF NOT EXISTS idx_health_scores_chart_number ON health_scores(chart_number);
CREATE INDEX IF NOT EXISTS idx_health_scores_score_date ON health_scores(score_date);
CREATE INDEX IF NOT EXISTS idx_health_scores_score_desc ON health_scores(score_date, score DESC);

-- 일별 랭킹 조회용: 특정 날짜 기준 점수 순위
-- 예: SELECT chart_number, score, RANK() OVER (ORDER BY score DESC) FROM health_scores WHERE score_date = '2025-02-06';

ALTER TABLE health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read health_scores for authenticated" ON health_scores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert health_scores for authenticated" ON health_scores
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update health_scores for authenticated" ON health_scores
  FOR UPDATE TO authenticated USING (true);


-- =====================================================
-- (선택) updated_at 자동 갱신 트리거 (health_scores)
-- =====================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS health_scores_updated_at ON health_scores;
CREATE TRIGGER health_scores_updated_at
  BEFORE UPDATE ON health_scores
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
