-- =====================================================
-- meal-photos 버킷 RLS 정책 (Row Level Security)
-- Supabase SQL Editor에서 실행하세요.
-- "new row violates row-level security policy" 403 오류 해결용
-- =====================================================

-- 기존 정책이 있으면 제거 후 재생성 (이름 충돌 방지)
DROP POLICY IF EXISTS "Users can upload meal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view meal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own meal photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read meal-photos" ON storage.objects;

-- 1) INSERT: 인증된 사용자가 자신의 폴더(user_id)에만 업로드 가능
-- 경로 형식: {user_id}/{category}/{filename}
CREATE POLICY "Users can upload meal photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meal-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2) SELECT: 공개 버킷이므로 인증/비인증 모두 조회 가능 (이미지 URL 접근)
CREATE POLICY "Users can view meal photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'meal-photos');

-- 3) DELETE: 본인 폴더의 파일만 삭제 가능
CREATE POLICY "Users can delete own meal photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'meal-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4) UPDATE: 본인 폴더의 파일만 수정 가능 (메타데이터 등)
CREATE POLICY "Users can update own meal photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meal-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'meal-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

SELECT 'meal-photos RLS 정책 적용 완료' AS result;
