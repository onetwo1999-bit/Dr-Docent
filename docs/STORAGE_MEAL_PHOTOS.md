# 식단 사진 업로드용 Storage 버킷 설정

`/api/upload`는 **Supabase Storage**의 `meal-photos` 버킷을 사용합니다.  
500 에러(Bucket not found)가 나면 아래 순서로 버킷을 생성하세요.

## 1. Supabase 대시보드

1. [Supabase](https://supabase.com/dashboard) 로그인 후 프로젝트 선택
2. 왼쪽 메뉴 **Storage** 클릭
3. **New bucket** 클릭

## 2. 버킷 생성

- **Name**: `meal-photos` (이름을 정확히 맞춰야 합니다)
- **Public bucket**: **ON** (체크) – 업로드된 이미지 공개 URL 사용
- **Create bucket** 클릭

## 3. 정책(RLS) 설정 (선택)

업로드/다운로드가 막히면 Storage 정책을 추가합니다.

- Storage → `meal-photos` → **Policies**
- **New policy** → "For full customization" 선택 후 아래와 유사하게 설정:

**업로드 허용 (인증된 사용자)**  
- Policy name: `Users can upload meal photos`
- Allowed operation: **INSERT**
- Target roles: `authenticated`
- USING expression: `true`
- WITH CHECK expression: `true`

**조회 허용 (공개 읽기)**  
- Policy name: `Public read for meal photos`
- Allowed operation: **SELECT**
- Target roles: `public` 또는 `anon`
- USING expression: `true`

저장 후 앱에서 다시 식단 사진 업로드를 시도해 보세요.
