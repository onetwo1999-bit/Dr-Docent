# 📊 Profiles 테이블 스키마 업데이트 가이드

## 🎯 목적
`profiles` 테이블에 `bmi`, `chronic_diseases`, `medications` 컬럼을 추가하여 프로필 저장 기능을 완전히 활성화합니다.

## 📝 실행 방법

### 1. Supabase 대시보드 접속
1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택

### 2. SQL Editor 열기
1. 왼쪽 사이드바에서 **"SQL Editor"** 클릭
2. **"New query"** 버튼 클릭

### 3. SQL 스크립트 실행
1. `supabase/profiles-schema-update.sql` 파일의 **전체 내용**을 복사
2. SQL Editor에 붙여넣기
3. **"Run"** 버튼 클릭 (또는 `Ctrl/Cmd + Enter`)

### 4. 실행 결과 확인
- 성공 시: `✅ profiles 테이블이 성공적으로 업데이트되었습니다!` 메시지 표시
- 각 컬럼 추가 시: `✅ [컬럼명] 컬럼 추가 완료` 메시지 표시

## ⚠️ 주의사항
- 이 스크립트는 **안전하게 설계**되어 있습니다:
  - 이미 존재하는 컬럼은 건너뜀 (`IF NOT EXISTS`)
  - 기존 데이터는 보존됨
  - RLS 정책도 자동으로 설정됨

## ✅ 확인 방법
SQL Editor에서 다음 쿼리로 확인:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('bmi', 'chronic_diseases', 'medications');
```

결과에 `bmi`, `chronic_diseases`, `medications` 컬럼이 모두 표시되면 성공입니다!
