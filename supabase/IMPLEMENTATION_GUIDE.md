# 닥터 도슨 고정밀 데이터 엔진 구현 가이드

## 🚀 구현 완료 사항

### 1. UI/UX 개선
- ✅ 헤더 프로필 이미지를 이모티콘(😊)으로 변경
- ✅ 모든 입력 필드에 상세한 placeholder 추가

### 2. 건강 기록 모달 시스템
- ✅ 식사 기록 모달 (사진 업로드, 상세 설명, 날짜/시간 선택)
- ✅ 운동 기록 모달 (종류, 시간, 심박수, 강도 지표)
- ✅ 복약 기록 모달 (약 이름, 용량, 성분, 메모)

### 3. 데이터베이스 확장
- ✅ `health_logs` 테이블 스키마 확장 SQL 작성
- ✅ 새로운 컬럼 추가:
  - `notes`: 상세 메모
  - `intensity_metrics`: 운동 강도 지표 (JSONB)
  - `exercise_type`: 운동 종류
  - `duration_minutes`: 운동 시간
  - `heart_rate`: 심박수
  - `medication_name`: 약 이름
  - `medication_dosage`: 약 용량
  - `medication_ingredients`: 주요 성분
  - `meal_description`: 식사 상세 설명
  - `image_url`: 식단 사진 URL

### 4. 백엔드 API
- ✅ 이미지 업로드 API (`/api/upload`)
- ✅ 건강 로그 API 확장 (새 필드 지원)

## 📋 실행 순서

### Step 1: 데이터베이스 스키마 업데이트
1. Supabase SQL Editor 열기
2. `supabase/health-logs-schema-expansion.sql` 실행
3. 실행 결과 확인

### Step 2: Storage 버킷 및 RLS
1. Supabase 대시보드 > Storage
2. `meal-photos` 버킷 생성 (Public) — 앱은 이 버킷 사용
3. **SQL Editor**에서 `supabase/storage-meal-photos-rls.sql` 실행 (RLS 정책 적용)
4. 403 / "row-level security policy" 오류 시 위 RLS SQL 재실행 확인

### Step 3: 테스트
1. 대시보드에서 "식사 기록" 버튼 클릭
2. 모달이 열리는지 확인
3. 이미지 업로드 테스트
4. 운동/복약 기록도 동일하게 테스트

## 🔧 향후 확장 가능 기능

### 건강 점수 계산 고도화
현재는 프로필 데이터만 사용하지만, 향후 `health_logs` 데이터를 활용하여:
- 운동 빈도 및 강도에 따른 체력 점수 가산
- 식단 영양 균형 분석 점수
- 복약 순응도 점수
- 종합 건강 점수 실시간 갱신

### AI 분석 연동
- 식단 이미지 AI 분석 (영양 성분 추출)
- 운동 강도 기반 칼로리 소모량 계산
- 약물 상호작용 체크

### 트레이너 대시보드 준비
- 사용자별 데이터 집계 쿼리 최적화
- 기간별 리포트 생성
- 데이터 내보내기 기능

## 📝 파일 구조

```
app/
├── components/
│   ├── MealLogModal.tsx          # 식사 기록 모달
│   ├── ExerciseLogModal.tsx       # 운동 기록 모달
│   ├── MedicationLogModal.tsx     # 복약 기록 모달
│   └── HealthLogButtons.tsx        # 기록 버튼 (모달 연동)
├── api/
│   ├── upload/route.ts            # 이미지 업로드 API
│   └── health-logs/route.ts       # 건강 로그 API (확장됨)
supabase/
├── health-logs-schema-expansion.sql  # DB 스키마 확장
├── STORAGE_SETUP.md                  # Storage 설정 가이드
└── IMPLEMENTATION_GUIDE.md            # 이 문서
```

## ⚠️ 주의사항

1. **Storage 버킷 생성 필수**: 이미지 업로드를 사용하려면 `meal-photos` 버킷을 생성하고, **반드시** `supabase/storage-meal-photos-rls.sql`을 실행해 RLS 정책을 적용해야 합니다.

2. **스키마 확장 필수**: 새로운 필드를 사용하려면 `health-logs-schema-expansion.sql`을 실행해야 합니다.

3. **RLS 정책**: Storage와 health_logs 테이블 모두 RLS 정책이 올바르게 설정되어 있어야 합니다.

## 🐛 문제 해결

### 이미지 업로드 실패 (403 / RLS)
- `meal-photos` 버킷 생성 여부 확인
- **SQL Editor에서 `supabase/storage-meal-photos-rls.sql` 실행** (RLS 정책 적용)
- 파일 경로가 `{user_id}/{category}/{filename}` 형식인지 확인 (API 기본값)
- 파일 크기 5MB 이하, 이미지 형식인지 확인

### 모달이 열리지 않음
- 브라우저 콘솔에서 에러 확인
- 컴포넌트 import 경로 확인

### 데이터 저장 실패
- `health-logs-schema-expansion.sql` 실행 여부 확인
- Supabase 로그에서 에러 메시지 확인
