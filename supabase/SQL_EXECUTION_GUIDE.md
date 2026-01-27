# Supabase SQL 스크립트 실행 가이드

## 📋 profiles 테이블 스키마 업데이트

현재 `profiles` 테이블에 `bmi`, `chronic_diseases`, `medications` 컬럼이 없어 프로필 저장이 완전하지 않습니다.

## 🚀 실행 방법

### 1단계: Supabase 대시보드 접속
1. https://supabase.com 접속
2. 프로젝트 선택
3. 좌측 메뉴에서 **"SQL Editor"** 클릭

### 2단계: SQL 스크립트 복사
1. 프로젝트 루트의 `supabase/profiles-schema-update.sql` 파일 열기
2. 파일 전체 내용 복사 (Ctrl+A → Ctrl+C)

### 3단계: SQL 실행
1. Supabase SQL Editor에서 **"New query"** 클릭
2. 복사한 SQL 스크립트 붙여넣기 (Ctrl+V)
3. 우측 상단의 **"Run"** 버튼 클릭 (또는 Ctrl+Enter)

### 4단계: 실행 결과 확인
성공적으로 실행되면 다음과 같은 메시지가 표시됩니다:
```
✅ chronic_diseases 컬럼 추가 완료
✅ medications 컬럼 추가 완료
✅ bmi 컬럼 추가 완료
✅ profiles 테이블이 성공적으로 업데이트되었습니다!
```

## ⚠️ 주의사항

- 이 스크립트는 **안전하게 설계**되었습니다:
  - 이미 존재하는 컬럼은 건너뜁니다
  - 기존 데이터는 유지됩니다
  - RLS 정책이 자동으로 설정됩니다

- 실행 전 확인사항:
  - 현재 로그인한 Supabase 프로젝트가 올바른지 확인
  - 백업이 필요하다면 먼저 백업 수행

## 🔍 실행 후 확인

SQL 실행 후 앱에서 프로필을 저장해보세요:
1. 프로필 저장 시 `bmi`, `chronic_diseases`, `medications` 데이터가 정상적으로 저장되는지 확인
2. 브라우저 콘솔에서 스키마 관련 경고 메시지가 사라졌는지 확인

## 📞 문제 해결

만약 에러가 발생한다면:
1. 에러 메시지를 확인하세요
2. `profiles` 테이블이 존재하는지 확인하세요
3. RLS 정책이 올바르게 설정되어 있는지 확인하세요

## 📝 추가 정보

- 스크립트 위치: `supabase/profiles-schema-update.sql`
- 관련 문서: `supabase/PROFILES_SCHEMA_SETUP.md`
