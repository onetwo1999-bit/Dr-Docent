-- =====================================================
-- 테스트용 가짜 유저 생성 (간단 버전 - profiles만 생성)
-- 
-- ⚠️ 이 방법은 기존 auth.users가 있는 경우에만 사용 가능합니다.
-- 또는 Supabase Dashboard에서 먼저 사용자를 생성한 후
-- 해당 사용자 ID를 사용하여 profiles를 생성하세요.
-- =====================================================

-- 기존 사용자 ID를 사용하여 profiles만 생성하는 방법
-- (예시: 기존 사용자가 5명 있다고 가정)

-- 방법 1: 기존 사용자에게 프로필 추가
DO $$
DECLARE
  v_user_ids UUID[];
  v_user_id UUID;
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
  i INT;
  v_chart_number TEXT;
BEGIN
  -- 기존 auth.users에서 ID 가져오기 (프로필이 없는 사용자만)
  SELECT ARRAY_AGG(id) INTO v_user_ids
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM profiles)
  LIMIT 20;
  
  -- 사용자가 부족하면 UUID 생성하여 profiles만 생성
  IF array_length(v_user_ids, 1) IS NULL OR array_length(v_user_ids, 1) < 20 THEN
    v_user_ids := ARRAY[]::UUID[];
    FOR i IN 1..20 LOOP
      v_user_id := gen_random_uuid();
      v_user_ids := array_append(v_user_ids, v_user_id);
    END LOOP;
  END IF;
  
  -- profiles 생성
  FOR i IN 1..LEAST(array_length(v_user_ids, 1), 20) LOOP
    v_user_id := v_user_ids[i];
    v_chart_number := UPPER(REPLACE(SUBSTRING(v_user_id::TEXT, 1, 8), '-', ''));
    
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
      v_user_id,
      v_ages[i],
      v_genders[i],
      v_heights[i],
      v_weights[i],
      'user',
      v_chart_number,
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
    
    RAISE NOTICE '✅ 프로필 생성 완료: % (%)', v_nicknames[i], v_user_id;
  END LOOP;
END;
$$;

-- 생성된 프로필 확인
SELECT 
  id,
  nickname,
  chart_number,
  age,
  gender,
  height,
  weight,
  bmi,
  role
FROM profiles
WHERE nickname IN (
  '김철수', '이영희', '박민수', '최지영', '정수진',
  '강호영', '윤서연', '임동현', '한소희', '조민준',
  '오지훈', '신유진', '류태현', '배수빈', '전혜진',
  '남도현', '문지은', '송재호', '유나영', '홍성민'
)
ORDER BY created_at DESC;

SELECT '✅ 프로필 생성 완료!' AS result;
