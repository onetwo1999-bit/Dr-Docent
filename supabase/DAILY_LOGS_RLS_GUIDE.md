# daily_logs RLS 정책 및 View 설정 가이드

## 📋 개요

`daily_logs` 테이블의 민감 정보(`weight`)를 보호하면서, 그룹원에게는 수행 여부(`medication_status`, `exercise_status`)만 공개하는 RLS 정책과 View 설정 가이드입니다.

## 🔒 보안 요구사항

1. **본인 데이터**: `weight` 포함 모든 컬럼 조회 가능
2. **그룹원 데이터**: `weight`는 `NULL`로 마스킹, `medication_status`와 `exercise_status`만 공개
3. **비그룹원**: 데이터 조회 불가

## 📁 파일 구조

```
supabase/
├── daily-logs-rls-view.sql    # RLS 정책 및 View 생성 SQL
└── DAILY_LOGS_RLS_GUIDE.md    # 이 가이드 문서
```

## 🚀 설치 방법

### 1. Supabase SQL Editor에서 실행

1. Supabase 대시보드 → SQL Editor 열기
2. `supabase/daily-logs-rls-view.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기 후 실행

### 2. 사전 요구사항 확인

다음 테이블과 컬럼이 존재해야 합니다:

- `profiles` 테이블 (id, chart_number)
- `user_groups` 테이블 (group_id, member_chart_numbers)

## 📊 테이블 구조

```sql
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  weight DECIMAL(5, 2),              -- 민감 정보 (본인만)
  medication_status BOOLEAN,         -- 공개 정보 (그룹원도)
  exercise_status BOOLEAN,           -- 공개 정보 (그룹원도)
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, date)
);
```

## 🔐 RLS 정책 설명

### 1. 본인 조회 정책
```sql
"Users can view own daily logs"
```
- **조건**: `auth.uid() = user_id`
- **권한**: 모든 컬럼 조회 가능 (weight 포함)

### 2. 그룹원 조회 정책
```sql
"Group members can view safe daily logs"
```
- **조건**: 
  - 본인이 아니면서 (`auth.uid() != user_id`)
  - 같은 그룹에 속해있음 (`user_groups` 테이블 확인)
- **권한**: View를 통해서만 조회 (weight는 NULL)

### 3. CRUD 정책
- **INSERT/UPDATE/DELETE**: 본인만 가능 (`auth.uid() = user_id`)

## 👁️ View: `public_safe_daily_logs`

### 목적
그룹원이 안전하게 조회할 수 있는 View입니다. `weight`는 항상 `NULL`로 반환됩니다.

### 구조
```sql
CREATE VIEW public_safe_daily_logs AS
SELECT
  id,
  user_id,
  date,
  NULL::DECIMAL(5, 2) AS weight,  -- 항상 NULL
  medication_status,
  exercise_status,
  created_at,
  updated_at
FROM daily_logs
WHERE [그룹원 필터링 조건]
```

### 사용 예시

#### 1. 본인 데이터 조회 (weight 포함)
```typescript
// Supabase Client
const { data } = await supabase
  .from('daily_logs')
  .select('*')
  .eq('user_id', userId)
```

#### 2. 그룹원 데이터 조회 (weight 제외)
```typescript
// View 사용
const { data } = await supabase
  .from('public_safe_daily_logs')
  .select('*')
```

#### 3. 특정 그룹원의 안전한 데이터 조회
```typescript
const { data } = await supabase
  .from('public_safe_daily_logs')
  .select('*')
  .eq('user_id', targetUserId)
```

## 🛠️ 헬퍼 함수: `is_group_member()`

두 사용자가 같은 그룹에 속해있는지 확인하는 함수입니다.

### 사용법
```sql
SELECT is_group_member(auth.uid(), 'target-user-id');
-- 반환: true 또는 false
```

### TypeScript에서 사용
```typescript
const { data } = await supabase.rpc('is_group_member', {
  p_current_user_id: currentUserId,
  p_target_user_id: targetUserId
})
```

## 📝 API 구현 예시

### Next.js API Route 예시

```typescript
// app/api/daily-logs/route.ts
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('user_id')

  // 본인 데이터 조회
  if (targetUserId === user.id) {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
    
    return NextResponse.json({ data })
  }

  // 그룹원 데이터 조회 (View 사용)
  const { data } = await supabase
    .from('public_safe_daily_logs')
    .select('*')
    .eq('user_id', targetUserId)
  
  return NextResponse.json({ data })
}
```

## ⚠️ 주의사항

1. **View는 읽기 전용**: `public_safe_daily_logs` View는 SELECT만 가능합니다.
2. **INSERT/UPDATE/DELETE**: 원본 `daily_logs` 테이블을 직접 사용하세요.
3. **그룹 확인**: View는 자동으로 그룹원 여부를 확인하지만, API 레벨에서도 검증하는 것을 권장합니다.
4. **성능**: `user_groups` 테이블의 `member_chart_numbers`에 GIN 인덱스가 있어야 합니다.

## 🔍 테스트 쿼리

### 1. 본인 데이터 확인
```sql
-- 본인 데이터 (weight 포함)
SELECT * FROM daily_logs WHERE user_id = auth.uid();
```

### 2. 그룹원 데이터 확인
```sql
-- 그룹원 데이터 (weight는 NULL)
SELECT * FROM public_safe_daily_logs;
```

### 3. 그룹원 여부 확인
```sql
-- 특정 사용자와 같은 그룹인지 확인
SELECT is_group_member(auth.uid(), 'target-user-id');
```

## 🐛 문제 해결

### View에서 데이터가 안 보여요
1. `profiles` 테이블에 `chart_number`가 설정되어 있는지 확인
2. `user_groups` 테이블에 두 사용자가 같은 그룹에 속해있는지 확인
3. RLS 정책이 올바르게 적용되었는지 확인

### RLS 정책 오류
```sql
-- 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'daily_logs';

-- 정책 재생성
-- daily-logs-rls-view.sql 파일의 정책 부분만 다시 실행
```

## 📚 참고 자료

- [Supabase RLS 문서](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Views 문서](https://www.postgresql.org/docs/current/sql-createview.html)
- 기존 그룹 캘린더 구현: `supabase/group-calendar-realtime.sql`
