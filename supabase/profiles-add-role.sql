-- =====================================================
-- Profiles 테이블에 role 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));
    RAISE NOTICE '✅ role 컬럼 추가 완료';
  END IF;
END $$;

-- 기본값 설정: 기존 레코드는 'user'로 설정
UPDATE profiles SET role = 'user' WHERE role IS NULL;

-- 인덱스 생성 (관리자 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE role = 'admin';

COMMENT ON COLUMN profiles.role IS '사용자 역할: user(일반 사용자), admin(관리자)';

-- 관리자 계정 생성 예시 (실제 사용 시 주석 해제하고 user_id 수정)
-- UPDATE profiles SET role = 'admin' WHERE id = 'your-admin-user-id';

SELECT '✅ profiles에 role 컬럼이 추가되었습니다.' AS result;
