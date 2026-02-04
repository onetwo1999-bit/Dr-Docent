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

## 3. RLS 정책 설정 (필수 – 403 오류 방지)

**"new row violates row-level security policy"** 가 나오면 반드시 아래 SQL을 실행하세요.

1. Supabase 대시보드 → **SQL Editor**
2. **New query** 클릭
3. 프로젝트 루트의 **`supabase/storage-meal-photos-rls.sql`** 파일 내용을 통째로 복사해 붙여넣기
4. **Run** 실행

이 스크립트는 다음 정책을 적용합니다.

- **INSERT**: 로그인한 사용자가 자신의 폴더(`user_id/`)에만 업로드 가능
- **SELECT**: 공개 읽기 (이미지 URL로 접근 가능)
- **DELETE / UPDATE**: 본인 폴더의 파일만 삭제·수정 가능

저장 후 앱에서 다시 식단 사진 업로드를 시도해 보세요.
