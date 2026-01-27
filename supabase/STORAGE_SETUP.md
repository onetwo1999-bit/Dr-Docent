# Supabase Storage 설정 가이드

## 📦 health-images 버킷 생성

식사 기록의 이미지 업로드를 위해 Supabase Storage 버킷을 생성해야 합니다.

### 1단계: Supabase 대시보드 접속
1. https://supabase.com 접속
2. 프로젝트 선택
3. 좌측 메뉴에서 **"Storage"** 클릭

### 2단계: 버킷 생성
1. **"New bucket"** 버튼 클릭
2. 버킷 이름: `health-images`
3. **Public bucket** 옵션 활성화 (이미지 URL 공개 접근용)
4. **"Create bucket"** 클릭

### 3단계: RLS 정책 설정
버킷 생성 후, SQL Editor에서 다음 정책을 실행하세요:

```sql
-- health-images 버킷 RLS 정책
-- 사용자는 자신의 파일만 업로드/조회/삭제 가능

-- 업로드 정책
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'health-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 조회 정책 (공개 버킷이므로 모든 인증된 사용자가 조회 가능)
CREATE POLICY "Users can view images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'health-images');

-- 삭제 정책
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'health-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### 4단계: 확인
1. Storage > health-images 버킷이 생성되었는지 확인
2. 이미지 업로드 테스트:
   - 대시보드에서 "식사 기록" 버튼 클릭
   - 이미지 업로드 시도
   - 업로드 성공 여부 확인

## 📝 참고사항

- 파일 경로 구조: `health-logs/{user_id}/{category}/{timestamp}_{random}.{ext}`
- 최대 파일 크기: 5MB
- 지원 형식: 이미지 파일만 (image/*)
- 공개 URL: 버킷이 Public이면 자동으로 공개 URL 생성

## 🔒 보안

- 각 사용자는 자신의 폴더(`{user_id}/`)에만 파일을 업로드할 수 있습니다
- RLS 정책으로 다른 사용자의 파일에 접근할 수 없습니다
