# 🌸 그날 케어 (Cycle Logs) 테이블 설정 가이드

## 📋 실행 방법

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭
   - "New query" 버튼 클릭

3. **SQL 스크립트 실행**
   - 아래 `cycle-logs-schema.sql` 파일의 내용을 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭

4. **결과 확인**
   - 성공 메시지가 표시되면 완료!
   - "Table Editor"에서 `cycle_logs` 테이블이 생성되었는지 확인

## ✅ 확인 사항

실행 후 다음을 확인하세요:

- [ ] `cycle_logs` 테이블이 생성되었는지
- [ ] `status` 컬럼이 있는지 (ongoing/completed)
- [ ] RLS 정책이 활성화되었는지
- [ ] 인덱스가 생성되었는지

## 🔧 문제 해결

### 에러: "relation cycle_logs already exists"
- 이미 테이블이 존재하는 경우입니다
- 스크립트는 자동으로 컬럼을 추가하므로 그대로 실행해도 됩니다

### 에러: "permission denied"
- RLS 정책이 제대로 생성되지 않았을 수 있습니다
- 스크립트를 다시 실행하거나, 수동으로 RLS 정책을 확인하세요
