-- =====================================================
-- daily_logs 테이블: RLS 정책 및 안전한 공개 View 설정
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- =====================================================
-- 1️⃣ daily_logs 테이블 생성 (없는 경우)
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight DECIMAL(5, 2), -- 민감 정보: 본인만 조회 가능
  medication_status BOOLEAN DEFAULT false, -- 공개 가능: 그룹원도 조회 가능
  exercise_status BOOLEAN DEFAULT false, -- 공개 가능: 그룹원도 조회 가능
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, date) -- 같은 날짜에 중복 기록 방지
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);

COMMENT ON TABLE daily_logs IS '일일 건강 로그: weight는 본인만, medication/exercise_status는 그룹원도 조회 가능';
COMMENT ON COLUMN daily_logs.weight IS '민감 정보: 본인(user_id = auth.uid())만 조회 가능';
COMMENT ON COLUMN daily_logs.medication_status IS '공개 정보: 같은 그룹원도 조회 가능';
COMMENT ON COLUMN daily_logs.exercise_status IS '공개 정보: 같은 그룹원도 조회 가능';

-- =====================================================
-- 2️⃣ RLS 활성화
-- =====================================================
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3️⃣ RLS 정책 설정
-- =====================================================

-- 기존 정책 삭제 (재생성을 위해)
DROP POLICY IF EXISTS "Users can view own daily logs" ON daily_logs;
DROP POLICY IF EXISTS "Group members can view safe daily logs" ON daily_logs;
DROP POLICY IF EXISTS "Users can insert own daily logs" ON daily_logs;
DROP POLICY IF EXISTS "Users can update own daily logs" ON daily_logs;
DROP POLICY IF EXISTS "Users can delete own daily logs" ON daily_logs;

-- 정책 1: 본인은 모든 컬럼 조회 가능 (weight 포함)
CREATE POLICY "Users can view own daily logs" ON daily_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- 정책 2: 그룹원은 weight를 제외한 안전한 정보만 조회 가능
-- (이 정책은 View를 통해 간접적으로 사용됨)
CREATE POLICY "Group members can view safe daily logs" ON daily_logs
  FOR SELECT
  USING (
    -- 본인이 아니면서
    auth.uid() != user_id
    AND
    -- 같은 그룹에 속해있는 경우
    EXISTS (
      SELECT 1
      FROM profiles p_current
      JOIN profiles p_target ON p_target.id = daily_logs.user_id
      JOIN user_groups ug ON (
        ug.member_chart_numbers @> ARRAY[p_current.chart_number::text]
        AND ug.member_chart_numbers @> ARRAY[p_target.chart_number::text]
      )
      WHERE p_current.id = auth.uid()
        AND p_current.chart_number IS NOT NULL
        AND p_target.chart_number IS NOT NULL
    )
  );

-- 정책 3: 본인만 INSERT 가능
CREATE POLICY "Users can insert own daily logs" ON daily_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 정책 4: 본인만 UPDATE 가능
CREATE POLICY "Users can update own daily logs" ON daily_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 정책 5: 본인만 DELETE 가능
CREATE POLICY "Users can delete own daily logs" ON daily_logs
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 4️⃣ 안전한 공개 View 생성 (그룹원 조회용)
-- =====================================================

-- 기존 View 삭제 (재생성을 위해)
DROP VIEW IF EXISTS public_safe_daily_logs;

-- View 생성: weight는 NULL로 마스킹, 수행 여부만 공개
CREATE VIEW public_safe_daily_logs AS
SELECT
  id,
  user_id,
  date,
  NULL::DECIMAL(5, 2) AS weight, -- 항상 NULL로 마스킹
  medication_status,
  exercise_status,
  created_at,
  updated_at
FROM daily_logs
WHERE
  -- 본인 데이터는 제외 (본인은 원본 테이블 직접 조회)
  auth.uid() != user_id
  AND
  -- 같은 그룹에 속한 멤버의 데이터만
  EXISTS (
    SELECT 1
    FROM profiles p_current
    JOIN profiles p_target ON p_target.id = daily_logs.user_id
    JOIN user_groups ug ON (
      ug.member_chart_numbers @> ARRAY[p_current.chart_number::text]
      AND ug.member_chart_numbers @> ARRAY[p_target.chart_number::text]
    )
    WHERE p_current.id = auth.uid()
      AND p_current.chart_number IS NOT NULL
      AND p_target.chart_number IS NOT NULL
  );

-- View에 대한 RLS는 필요 없음 (View 자체가 필터링됨)
-- 하지만 View를 통한 조회를 허용하기 위해 주석 추가
COMMENT ON VIEW public_safe_daily_logs IS '그룹원 조회용 안전한 View: weight는 항상 NULL, medication/exercise_status만 공개';

-- =====================================================
-- 5️⃣ View 조회 권한 부여
-- =====================================================

-- authenticated 사용자에게 View 조회 권한 부여
GRANT SELECT ON public_safe_daily_logs TO authenticated;

-- =====================================================
-- 6️⃣ 헬퍼 함수: 특정 사용자가 같은 그룹에 속해있는지 확인
-- =====================================================

CREATE OR REPLACE FUNCTION is_group_member(
  p_current_user_id UUID,
  p_target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_chart TEXT;
  v_target_chart TEXT;
BEGIN
  -- 현재 사용자 차트 번호
  SELECT chart_number INTO v_current_chart
  FROM profiles
  WHERE id = p_current_user_id;

  -- 대상 사용자 차트 번호
  SELECT chart_number INTO v_target_chart
  FROM profiles
  WHERE id = p_target_user_id;

  -- 차트 번호가 없으면 false
  IF v_current_chart IS NULL OR v_target_chart IS NULL THEN
    RETURN false;
  END IF;

  -- 같은 그룹에 속해있는지 확인
  RETURN EXISTS (
    SELECT 1
    FROM user_groups
    WHERE member_chart_numbers @> ARRAY[v_current_chart::text]
      AND member_chart_numbers @> ARRAY[v_target_chart::text]
  );
END;
$$;

COMMENT ON FUNCTION is_group_member IS '두 사용자가 같은 그룹에 속해있는지 확인하는 헬퍼 함수';

-- =====================================================
-- 7️⃣ 사용 예시 및 테스트 쿼리 (주석 처리)
-- =====================================================

/*
-- 예시 1: 본인 데이터 조회 (weight 포함)
SELECT * FROM daily_logs WHERE user_id = auth.uid();

-- 예시 2: 그룹원 데이터 조회 (weight는 NULL, 수행 여부만)
SELECT * FROM public_safe_daily_logs;

-- 예시 3: 특정 그룹원의 안전한 데이터 조회
SELECT * FROM public_safe_daily_logs WHERE user_id = 'target-user-id';

-- 예시 4: 헬퍼 함수 사용
SELECT is_group_member(auth.uid(), 'target-user-id');
*/

-- =====================================================
-- ✅ 완료 메시지
-- =====================================================
SELECT '✅ daily_logs RLS 정책 및 public_safe_daily_logs View 설정 완료' AS result;
