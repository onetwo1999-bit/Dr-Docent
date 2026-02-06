# 테스트 유저 생성 가이드

## 🔍 문제 원인

1. **pgcrypto 확장 미활성화**: `gen_salt` 함수를 사용하려면 `pgcrypto` 확장이 필요합니다.
2. **Supabase 제한**: `auth.users` 테이블에 직접 INSERT하는 것은 보안상 제한될 수 있습니다.

## ✅ 해결 방법 (3가지)

### 방법 1: pgcrypto 확장 수동 활성화 후 실행 (권장)

#### 1단계: pgcrypto 확장 활성화

**Supabase Dashboard에서:**
1. Supabase Dashboard → **Database** → **Extensions** 이동
2. 검색창에 `pgcrypto` 입력
3. `pgcrypto` 확장 찾기
4. **Enable** 버튼 클릭

**또는 SQL Editor에서:**
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

#### 2단계: 수정된 스크립트 실행

`supabase/create-test-users-v2.sql` 파일을 실행하세요.

---

### 방법 2: 간단 버전 (profiles만 생성)

`supabase/create-test-users-simple.sql` 파일을 실행하세요.

이 방법은:
- 기존 `auth.users`에 프로필을 추가하거나
- UUID만 생성하여 `profiles`에 저장합니다
- ⚠️ 단점: 실제 로그인은 불가능하지만, 테스트 데이터로는 충분합니다

---

### 방법 3: Supabase Dashboard에서 수동 생성 (가장 안전)

#### 1단계: 사용자 생성

1. Supabase Dashboard → **Authentication** → **Users** 이동
2. **Add user** → **Create new user** 클릭
3. 각 유저마다:
   - Email: `test_user_1@test.com` ~ `test_user_20@test.com`
   - Password: `test123456`
   - Auto Confirm User: ✅ 체크
   - **Create user** 클릭

#### 2단계: 프로필 생성 스크립트 실행

사용자를 생성한 후, 아래 SQL을 실행하여 프로필을 추가하세요:

```sql
-- 생성된 사용자 ID를 사용하여 프로필 생성
-- (아래 스크립트는 auth.users에 있는 사용자에게 프로필을 추가합니다)

DO $$
DECLARE
  v_user RECORD;
  v_nicknames TEXT[] := ARRAY[
    '김철수', '이영희', '박민수', '최지영', '정수진',
    '강호영', '윤서연', '임동현', '한소희', '조민준',
    '오지훈', '신유진', '류태현', '배수빈', '전혜진',
    '남도현', '문지은', '송재호', '유나영', '홍성민'
  ];
  v_ages INT[] := ARRAY[25, 28, 32, 35, 38, 42, 45, 48, 52, 55, 30, 33, 36, 40, 43, 46, 50, 53, 27, 29];
  v_heights NUMERIC[] := ARRAY[165, 170, 175, 160, 168, 172, 178, 162, 175, 180, 167, 173, 176, 163, 171, 177, 164, 174, 169, 166];
  v_weights NUMERIC[] := ARRAY[60, 65, 70, 55, 62, 68, 75, 58, 72, 80, 63, 69, 73, 56, 66, 74, 59, 71, 64, 67];
  v_genders TEXT[] := ARRAY['male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female'];
  i INT := 1;
BEGIN
  FOR v_user IN 
    SELECT id, email 
    FROM auth.users 
    WHERE email LIKE 'test_user_%@test.com'
    ORDER BY created_at
    LIMIT 20
  LOOP
    IF i > 20 THEN EXIT; END IF;
    
    INSERT INTO public.profiles (
      id,
      age,
      gender,
      height,
      weight,
      role,
      chart_number,
      nickname,
      bmi,
      created_at,
      updated_at
    ) VALUES (
      v_user.id,
      v_ages[i],
      v_genders[i],
      v_heights[i],
      v_weights[i],
      'user',
      UPPER(REPLACE(SUBSTRING(v_user.id::TEXT, 1, 8), '-', '')),
      v_nicknames[i],
      ROUND(v_weights[i] / POWER(v_heights[i] / 100.0, 2), 2),
      NOW(),
      NOW()
    ) ON CONFLICT (id) DO UPDATE SET
      age = EXCLUDED.age,
      gender = EXCLUDED.gender,
      height = EXCLUDED.height,
      weight = EXCLUDED.weight,
      chart_number = EXCLUDED.chart_number,
      nickname = EXCLUDED.nickname,
      bmi = EXCLUDED.bmi,
      updated_at = NOW();
    
    i := i + 1;
  END LOOP;
END;
$$;

-- 생성 확인
SELECT 
  p.id,
  p.nickname,
  p.chart_number,
  p.age,
  p.gender,
  p.height,
  p.weight,
  p.bmi,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email LIKE 'test_user_%@test.com'
ORDER BY p.created_at DESC;
```

---

## 🎯 추천 방법

**방법 3 (수동 생성)**을 권장합니다:
- 가장 안전하고 확실함
- Supabase의 정식 인증 시스템 사용
- 실제 로그인 테스트 가능

---

## ✅ 생성 확인

어떤 방법을 사용하든, 생성 후 확인:

```sql
SELECT 
  p.id,
  p.nickname,
  p.chart_number,
  p.age,
  p.gender,
  p.height,
  p.weight,
  p.bmi,
  p.role
FROM profiles p
WHERE p.nickname IN (
  '김철수', '이영희', '박민수', '최지영', '정수진',
  '강호영', '윤서연', '임동현', '한소희', '조민준',
  '오지훈', '신유진', '류태현', '배수빈', '전혜진',
  '남도현', '문지은', '송재호', '유나영', '홍성민'
)
ORDER BY p.created_at DESC;
```

20명이 모두 표시되면 성공입니다!
