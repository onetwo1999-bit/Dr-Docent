-- =====================================================
-- 3. Supabase Storage 설정 (meal-photos 버킷)
-- 
-- ⚠️ 중요: 이 스크립트는 Supabase Dashboard에서 수동으로 실행해야 합니다.
-- Storage는 SQL로 직접 생성할 수 없으므로, 아래 단계를 따라주세요.
-- =====================================================

-- =====================================================
-- 3-1. Storage 버킷 생성 (수동 작업 필요)
-- =====================================================

/*
수동 작업:
1. Supabase Dashboard → Storage 이동
2. "New bucket" 클릭
3. Bucket name: "meal-photos"
4. Public bucket: ✅ 체크 (퍼블릭으로 설정)
5. File size limit: 5MB (또는 원하는 크기)
6. Allowed MIME types: image/jpeg, image/png, image/webp
7. "Create bucket" 클릭
*/

-- =====================================================
-- 3-2. Storage RLS 정책 설정
-- =====================================================

-- 인증된 사용자는 본인의 폴더에만 업로드 가능
CREATE POLICY "Users can upload own meal photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meal-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 인증된 사용자는 본인의 폴더에서만 파일 조회 가능
CREATE POLICY "Users can view own meal photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'meal-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 인증된 사용자는 본인의 폴더에서만 파일 삭제 가능
CREATE POLICY "Users can delete own meal photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'meal-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 인증된 사용자는 본인의 폴더에서만 파일 업데이트 가능
CREATE POLICY "Users can update own meal photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meal-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- 3-3. Storage 헬퍼 함수 (파일 경로 생성)
-- =====================================================

CREATE OR REPLACE FUNCTION get_meal_photo_path(
  p_user_id UUID,
  p_filename TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- 경로 형식: {user_id}/{filename}
  RETURN p_user_id::text || '/' || p_filename;
END;
$$;

COMMENT ON FUNCTION get_meal_photo_path IS '식사 사진 저장 경로 생성: {user_id}/{filename}';

SELECT '✅ Storage RLS 정책 설정 완료. 버킷은 Dashboard에서 수동 생성해주세요.' AS result;
