-- =====================================================
-- 4. 관계형 그룹 기능 (user_groups, group_members)
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- =====================================================
-- 4-1. user_groups 테이블 (그룹 정보)
-- =====================================================

-- 기존 테이블이 다른 스키마로 생성되었을 수 있으므로, 컬럼 추가 방식으로 처리
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_name TEXT,
  group_type TEXT DEFAULT 'family' CHECK (group_type IN ('family', 'friends', 'couple')),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 테이블에 필요한 컬럼이 없으면 추가
DO $$
BEGIN
  -- group_name 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_groups' AND column_name = 'group_name'
  ) THEN
    ALTER TABLE user_groups ADD COLUMN group_name TEXT;
  END IF;

  -- group_type 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_groups' AND column_name = 'group_type'
  ) THEN
    ALTER TABLE user_groups ADD COLUMN group_type TEXT DEFAULT 'family';
    ALTER TABLE user_groups ADD CONSTRAINT user_groups_group_type_check 
      CHECK (group_type IN ('family', 'friends', 'couple'));
  END IF;

  -- created_by 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_groups' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE user_groups ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- updated_at 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_groups' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE user_groups ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- created_at이 NOT NULL이 아니면 기본값 설정
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_groups' AND column_name = 'created_at' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE user_groups ALTER COLUMN created_at SET DEFAULT NOW();
    UPDATE user_groups SET created_at = NOW() WHERE created_at IS NULL;
    ALTER TABLE user_groups ALTER COLUMN created_at SET NOT NULL;
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_groups_created_by ON user_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_type ON user_groups(group_type);

COMMENT ON TABLE user_groups IS '사용자 그룹: 가족, 친구, 연인 그룹';
COMMENT ON COLUMN user_groups.group_type IS '그룹 유형: family(가족), friends(친구), couple(연인)';
COMMENT ON COLUMN user_groups.created_by IS '그룹 생성자 user_id';

-- =====================================================
-- 4-2. group_members 테이블 (그룹 멤버 및 관계)
-- =====================================================

CREATE TABLE IF NOT EXISTS group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('self', 'parent', 'partner', 'friend')),
  nickname TEXT, -- 그룹 내에서 보여질 닉네임
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(group_id, user_id) -- 같은 그룹에 중복 가입 방지
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_relationship ON group_members(relationship);

COMMENT ON TABLE group_members IS '그룹 멤버: 그룹에 속한 사용자 및 관계 정보';
COMMENT ON COLUMN group_members.relationship IS '관계: self(본인), parent(부모), partner(연인), friend(친구)';
COMMENT ON COLUMN group_members.nickname IS '그룹 내에서 보여질 닉네임 (예: "어머니", "아빠", "철수")';

-- =====================================================
-- 4-3. group_activity_summary 뷰 (활동 아이콘만 공유)
-- =====================================================

-- 민감 정보(키, 몸무게)를 제외한 활동 여부만 공유하는 뷰
CREATE OR REPLACE VIEW group_activity_summary AS
SELECT
  gm.group_id,
  gm.user_id,
  gm.relationship,
  gm.nickname,
  DATE(h.logged_at AT TIME ZONE 'Asia/Seoul') AS activity_date,
  BOOL_OR(h.category = 'meal') AS has_meal,
  BOOL_OR(h.category = 'exercise') AS has_exercise,
  BOOL_OR(h.category = 'medication') AS has_medication,
  BOOL_OR(h.category = 'sleep') AS has_sleep,
  COUNT(DISTINCT h.id) AS total_activities
FROM group_members gm
LEFT JOIN health_logs h ON h.user_id = gm.user_id
WHERE gm.is_active = true
GROUP BY gm.group_id, gm.user_id, gm.relationship, gm.nickname, DATE(h.logged_at AT TIME ZONE 'Asia/Seoul');

COMMENT ON VIEW group_activity_summary IS '그룹 활동 요약: 민감 정보 제외, 활동 아이콘만 표시';

-- 뷰 조회 권한 부여
GRANT SELECT ON group_activity_summary TO authenticated;

-- =====================================================
-- 4-4. RLS 정책 설정
-- =====================================================

-- user_groups RLS
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (다른 스키마로 생성된 정책과 충돌 방지)
DO $$
BEGIN
  -- 기존 정책들 삭제
  DROP POLICY IF EXISTS "Allow read user_groups for authenticated" ON user_groups;
  DROP POLICY IF EXISTS "Allow insert user_groups for authenticated" ON user_groups;
  DROP POLICY IF EXISTS "Allow update user_groups for authenticated" ON user_groups;
END $$;

DO $$
BEGIN
  -- 그룹 생성자는 자신이 만든 그룹 조회 가능
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_groups' AND policyname = 'Users can view own groups') THEN
    CREATE POLICY "Users can view own groups" ON user_groups
      FOR SELECT USING (
        (created_by IS NOT NULL AND created_by = auth.uid()) OR
        EXISTS (SELECT 1 FROM group_members WHERE group_id = user_groups.id AND user_id = auth.uid())
      );
  END IF;

  -- 인증된 사용자는 그룹 생성 가능 (created_by가 NULL일 수도 있으므로 체크 완화)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_groups' AND policyname = 'Users can create groups') THEN
    CREATE POLICY "Users can create groups" ON user_groups
      FOR INSERT WITH CHECK (
        created_by IS NULL OR created_by = auth.uid()
      );
  END IF;

  -- 그룹 생성자만 수정/삭제 가능
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_groups' AND policyname = 'Users can update own groups') THEN
    CREATE POLICY "Users can update own groups" ON user_groups
      FOR UPDATE USING (
        created_by IS NOT NULL AND created_by = auth.uid()
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_groups' AND policyname = 'Users can delete own groups') THEN
    CREATE POLICY "Users can delete own groups" ON user_groups
      FOR DELETE USING (
        created_by IS NOT NULL AND created_by = auth.uid()
      );
  END IF;
END $$;

-- group_members RLS
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- 그룹 멤버는 자신이 속한 그룹의 멤버 목록 조회 가능
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_members' AND policyname = 'Group members can view members') THEN
    CREATE POLICY "Group members can view members" ON group_members
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM group_members gm
          WHERE gm.group_id = group_members.group_id
            AND gm.user_id = auth.uid()
        )
      );
  END IF;

  -- 그룹 생성자 또는 본인은 멤버 추가 가능
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_members' AND policyname = 'Users can add members') THEN
    CREATE POLICY "Users can add members" ON group_members
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_groups
          WHERE id = group_members.group_id
            AND (created_by = auth.uid() OR EXISTS (
              SELECT 1 FROM group_members
              WHERE group_id = user_groups.id AND user_id = auth.uid()
            ))
        )
      );
  END IF;

  -- 본인은 자신의 멤버 정보 수정 가능
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_members' AND policyname = 'Users can update own membership') THEN
    CREATE POLICY "Users can update own membership" ON group_members
      FOR UPDATE USING (user_id = auth.uid());
  END IF;

  -- 그룹 생성자 또는 본인은 멤버 삭제 가능
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_members' AND policyname = 'Users can remove members') THEN
    CREATE POLICY "Users can remove members" ON group_members
      FOR DELETE USING (
        user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_groups
          WHERE id = group_members.group_id
            AND created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- =====================================================
-- 4-5. 그룹 활동 조회 함수 (민감 정보 제외)
-- =====================================================

CREATE OR REPLACE FUNCTION get_group_activity_icons(
  p_group_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  user_id UUID,
  relationship TEXT,
  nickname TEXT,
  activity_date DATE,
  has_meal BOOLEAN,
  has_exercise BOOLEAN,
  has_medication BOOLEAN,
  has_sleep BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 그룹 멤버인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION '그룹 멤버만 조회할 수 있습니다.';
  END IF;

  RETURN QUERY
  SELECT
    gm.user_id,
    gm.relationship,
    gm.nickname,
    DATE(h.logged_at AT TIME ZONE 'Asia/Seoul') AS activity_date,
    BOOL_OR(h.category = 'meal') AS has_meal,
    BOOL_OR(h.category = 'exercise') AS has_exercise,
    BOOL_OR(h.category = 'medication') AS has_medication,
    BOOL_OR(h.category = 'sleep') AS has_sleep
  FROM group_members gm
  LEFT JOIN health_logs h ON h.user_id = gm.user_id
    AND DATE(h.logged_at AT TIME ZONE 'Asia/Seoul') BETWEEN p_start_date AND p_end_date
  WHERE gm.group_id = p_group_id
    AND gm.is_active = true
  GROUP BY gm.user_id, gm.relationship, gm.nickname, DATE(h.logged_at AT TIME ZONE 'Asia/Seoul')
  ORDER BY activity_date DESC, gm.user_id;
END;
$$;

COMMENT ON FUNCTION get_group_activity_icons IS '그룹 활동 아이콘 조회: 민감 정보 제외, 활동 여부만 반환';

SELECT '✅ 관계형 그룹 기능 테이블 및 함수 생성 완료' AS result;
