-- =====================================================
-- 그룹 캘린더: 활동만 집계 (민감 데이터 없음) + Realtime용 이벤트 테이블
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- 1) 그룹 활동 알림 테이블 (Realtime 구독용)
CREATE TABLE IF NOT EXISTS group_activity_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_activity_events_group_id ON group_activity_events(group_id);
CREATE INDEX IF NOT EXISTS idx_group_activity_events_updated_at ON group_activity_events(updated_at);

ALTER TABLE group_activity_events ENABLE ROW LEVEL SECURITY;

-- 그룹원만 해당 그룹의 이벤트 조회 가능 (chart_number가 member_chart_numbers에 포함된 경우)
CREATE POLICY "Group members can read own group events" ON group_activity_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_groups g ON g.group_id = group_activity_events.group_id
      WHERE p.id = auth.uid()
        AND p.chart_number IS NOT NULL
        AND g.member_chart_numbers @> ARRAY[p.chart_number::text]
    )
  );

-- 트리거에서 삽입은 service role 또는 트리거 오너로 수행
CREATE POLICY "Allow insert for trigger" ON group_activity_events
  FOR INSERT WITH CHECK (true);

-- 2) 그룹 캘린더 활동 집계 함수 (날짜·카테고리만 반환, 수치·메모 등 미포함)
CREATE OR REPLACE FUNCTION get_group_calendar_activity(
  p_group_id TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(activity_date DATE, category TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_ids UUID[];
  v_current_chart TEXT;
BEGIN
  -- 현재 사용자 차트 번호
  SELECT chart_number INTO v_current_chart FROM profiles WHERE id = auth.uid();
  IF v_current_chart IS NULL THEN
    RETURN;
  END IF;

  -- 그룹 존재 및 현재 사용자가 그룹원인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM user_groups
    WHERE group_id = p_group_id AND member_chart_numbers @> ARRAY[v_current_chart::text]
  ) THEN
    RETURN;
  END IF;

  -- 그룹원 user_id 목록 (profiles.id)
  SELECT ARRAY_AGG(p.id) INTO v_member_ids
  FROM profiles p
  WHERE p.chart_number = ANY(
    SELECT unnest(member_chart_numbers) FROM user_groups WHERE group_id = p_group_id
  );

  IF v_member_ids IS NULL OR array_length(v_member_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- health_logs에서 날짜·카테고리만 반환 (민감 데이터 절대 미포함)
  -- 로컬 날짜 기준: Asia/Seoul (필요 시 DB에 timezone 확장 설치)
  RETURN QUERY
  SELECT
    (h.logged_at AT TIME ZONE 'Asia/Seoul')::DATE AS activity_date,
    h.category::TEXT
  FROM health_logs h
  WHERE h.user_id = ANY(v_member_ids)
    AND (h.logged_at AT TIME ZONE 'Asia/Seoul')::DATE BETWEEN p_start_date AND p_end_date
    AND h.category IN ('meal', 'exercise', 'medication');
END;
$$;

-- 3) health_logs INSERT 시 해당 사용자가 속한 그룹에 이벤트 삽입 (Realtime 알림용)
CREATE OR REPLACE FUNCTION notify_group_activity_on_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chart TEXT;
  g RECORD;
BEGIN
  SELECT chart_number INTO v_chart FROM profiles WHERE id = NEW.user_id;
  IF v_chart IS NULL THEN
    RETURN NEW;
  END IF;

  FOR g IN
    SELECT group_id FROM user_groups
    WHERE member_chart_numbers @> ARRAY[v_chart::text]
  LOOP
    INSERT INTO group_activity_events (group_id) VALUES (g.group_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_group_activity_on_log ON health_logs;
CREATE TRIGGER trigger_notify_group_activity_on_log
  AFTER INSERT ON health_logs
  FOR EACH ROW EXECUTE PROCEDURE notify_group_activity_on_log();

-- Realtime 적용 방법:
-- Supabase 대시보드 → Database → Replication → group_activity_events 테이블 체크 후 저장.

SELECT '✅ 그룹 캘린더 함수·이벤트 테이블·트리거 설정 완료' AS result;
