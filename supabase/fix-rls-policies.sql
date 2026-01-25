-- =====================================================
-- 🔧 Health Logs RLS 정책 수정 (재생성)
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- 기존 정책 삭제 (에러 무시)
DROP POLICY IF EXISTS "Users can view own health logs" ON health_logs;
DROP POLICY IF EXISTS "Users can insert own health logs" ON health_logs;
DROP POLICY IF EXISTS "Users can update own health logs" ON health_logs;
DROP POLICY IF EXISTS "Users can delete own health logs" ON health_logs;

-- RLS 활성화 확인
ALTER TABLE health_logs ENABLE ROW LEVEL SECURITY;

-- 새로운 정책 생성 (더 명확한 조건)
CREATE POLICY "Users can view own health logs" 
ON health_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health logs" 
ON health_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health logs" 
ON health_logs 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own health logs" 
ON health_logs 
FOR DELETE 
USING (auth.uid() = user_id);

-- 정책 확인 쿼리
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'health_logs'
ORDER BY policyname;

-- =====================================================
-- ✅ 완료! 정책이 재생성되었습니다.
-- =====================================================
