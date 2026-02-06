# 데이터베이스 설정 완료 가이드

## 📋 작업 목록

1. ✅ heart_rate 컬럼 추가 및 schedules 충돌 해결
2. ✅ 포인트 시스템 및 수면 데이터
3. ✅ Storage 설정 (meal-photos 버킷)
4. ✅ 관계형 그룹 기능

---

## 🚀 실행 순서

### 1단계: heart_rate 및 schedules 수정

**파일**: `supabase/fix-heart-rate-and-schedules.sql`

```sql
-- Supabase SQL Editor에서 실행
```

**수행 작업**:
- `health_logs` 테이블에 `heart_rate` 컬럼 추가
- `schedules` 테이블의 `days`와 `days_of_week` 동기화
- 자동 동기화 트리거 생성

---

### 2단계: 포인트 시스템 및 수면 로그

**파일**: `supabase/points-system-and-sleep-logs.sql`

```sql
-- Supabase SQL Editor에서 실행
```

**생성되는 테이블**:
- `sleep_logs`: 수면 로그 (sleep_duration, quality_score, wake_up_time 등)
- `user_points`: 사용자 포인트 (일일 최대 10점, 연간 최대 3,650점)

**자동 트리거**:
- `health_logs` INSERT 시 포인트 자동 지급
- `sleep_logs` INSERT 시 포인트 자동 지급
- 일일/연간 제한 자동 검증

**포인트 계산 규칙**:
- 운동: 3점
- 복약: 2점
- 수면: 2점
- 식사: 회당 1점 (일 최대 3점)

---

### 3단계: Storage 설정

**파일**: `supabase/storage-meal-photos-setup.sql`

#### 수동 작업 (필수):

1. **Supabase Dashboard → Storage** 이동
2. **"New bucket"** 클릭
3. 설정:
   - Bucket name: `meal-photos`
   - Public bucket: ✅ 체크
   - File size limit: `5MB`
   - Allowed MIME types: `image/jpeg, image/png, image/webp`
4. **"Create bucket"** 클릭

#### SQL 실행:

```sql
-- RLS 정책 설정 (supabase/storage-meal-photos-setup.sql 실행)
```

**RLS 정책**:
- 인증된 사용자만 본인 폴더(`{user_id}/`)에 업로드/조회/삭제 가능
- 경로 형식: `{user_id}/{filename}`

---

### 4단계: 관계형 그룹 기능

**파일**: `supabase/group-tables-schema.sql`

```sql
-- Supabase SQL Editor에서 실행
```

**생성되는 테이블**:
- `user_groups`: 그룹 정보 (group_name, group_type: family/friends/couple)
- `group_members`: 그룹 멤버 및 관계 (relationship: self/parent/partner/friend)

**생성되는 뷰/함수**:
- `group_activity_summary`: 활동 아이콘만 공유 (민감 정보 제외)
- `get_group_activity_icons()`: 그룹 활동 조회 함수

**보안**:
- 그룹 멤버만 그룹 활동 조회 가능
- 민감 정보(키, 몸무게)는 제외하고 활동 여부만 표시

---

## 📊 포인트 API 사용법

### 현재 포인트 조회

```typescript
// GET /api/points
const response = await fetch('/api/points')
const data = await response.json()

// 응답:
{
  success: true,
  data: {
    daily_points: 7,        // 오늘 획득한 포인트
    annual_points: 245,     // 올해 누적 포인트
    daily_remaining: 3,      // 오늘 남은 포인트 (10 - 7)
    annual_remaining: 3405,  // 올해 남은 포인트 (3650 - 245)
    daily_cap: 10,
    annual_cap: 3650
  }
}
```

---

## 🔍 확인 쿼리

### 포인트 시스템 확인

```sql
-- 사용자 포인트 조회
SELECT * FROM user_points WHERE user_id = 'your-user-id';

-- 오늘 활동별 포인트 확인
SELECT 
  category,
  COUNT(*) as count,
  calculate_points_for_activity(category, COUNT(*)) as points
FROM health_logs
WHERE user_id = 'your-user-id'
  AND DATE(logged_at) = CURRENT_DATE
GROUP BY category;
```

### 수면 로그 확인

```sql
-- 수면 로그 조회
SELECT * FROM sleep_logs 
WHERE user_id = 'your-user-id'
ORDER BY sleep_date DESC;
```

### 그룹 기능 확인

```sql
-- 그룹 목록 조회
SELECT * FROM user_groups WHERE created_by = 'your-user-id';

-- 그룹 멤버 조회
SELECT gm.*, ug.group_name, ug.group_type
FROM group_members gm
JOIN user_groups ug ON ug.id = gm.group_id
WHERE gm.user_id = 'your-user-id';

-- 그룹 활동 아이콘 조회
SELECT * FROM get_group_activity_icons(
  'group-id-here',
  '2026-01-01',
  '2026-01-31'
);
```

---

## ⚠️ 주의사항

1. **Storage 버킷**: SQL로 자동 생성 불가 → Dashboard에서 수동 생성 필수
2. **포인트 트리거**: `health_logs`와 `sleep_logs` INSERT 시 자동 실행
3. **일일 포인트 리셋**: 날짜가 바뀌면 자동으로 일일 포인트는 0으로 시작
4. **연간 포인트 리셋**: 매년 1월 1일에 `reset_annual_points()` 함수 실행 필요

---

## ✅ 완료 체크리스트

- [ ] `fix-heart-rate-and-schedules.sql` 실행
- [ ] `points-system-and-sleep-logs.sql` 실행
- [ ] Storage 버킷 `meal-photos` 수동 생성
- [ ] `storage-meal-photos-setup.sql` 실행 (RLS 정책)
- [ ] `group-tables-schema.sql` 실행
- [ ] Supabase Dashboard → Settings → API → "Reload schema" 클릭

---

## 🎯 다음 단계

모든 SQL 실행 후:
1. `/api/points` API 테스트
2. 수면 로그 생성 테스트
3. 그룹 생성 및 멤버 추가 테스트
4. 그룹 활동 아이콘 조회 테스트
