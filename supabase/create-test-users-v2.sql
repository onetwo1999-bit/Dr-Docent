-- =====================================================
-- 테스트용 가짜 유저 20명 생성 (수정 버전)
-- Supabase SQL Editor에서 실행하세요.
-- 
-- ⚠️ 중요: 이 스크립트는 두 단계로 실행해야 합니다.
-- 1단계: pgcrypto 확장 활성화 (수동 실행 필요)
-- 2단계: 함수 생성 및 실행
-- =====================================================

-- =====================================================
-- 1단계: pgcrypto 확장 활성화 (먼저 실행)
-- =====================================================
-- Supabase Dashboard → Database → Extensions에서
-- "pgcrypto" 확장을 찾아서 활성화하거나,
-- 아래 SQL을 먼저 실행하세요:

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 확장이 활성화되었는지 확인
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- =====================================================
-- 2단계: 테스트 유저 생성 함수
-- =====================================================

-- 기존 함수 삭제 (있다면)
DROP FUNCTION IF EXISTS create_test_users();

-- RLS 정책을 우회하기 위한 SECURITY DEFINER 함수 생성
CREATE OR REPLACE FUNCTION create_test_users()
RETURNS TABLE(created_count INTEGER, user_ids UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_user_ids UUID[] := ARRAY[]::UUID[];
  v_chart_number TEXT;
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
  v_salt TEXT;
  v_encrypted_password TEXT;
BEGIN
  -- pgcrypto 확장 확인
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE EXCEPTION 'pgcrypto 확장이 활성화되지 않았습니다. 먼저 CREATE EXTENSION pgcrypto; 를 실행하세요.';
  END IF;

  -- 20명의 테스트 유저 생성
  FOR i IN 1..20 LOOP
    -- UUID 생성
    v_user_id := gen_random_uuid();
    v_user_ids := array_append(v_user_ids, v_user_id);
    
    -- 차트 번호 생성 (UUID의 첫 8자리)
    v_chart_number := UPPER(REPLACE(SUBSTRING(v_user_id::TEXT, 1, 8), '-', ''));
    
    -- 비밀번호 해싱 (bcrypt)
    v_salt := gen_salt('bf'::text, 10);
    v_encrypted_password := crypt('test123456', v_salt);
    
    -- auth.users에 사용자 생성 (이메일은 테스트용)
    BEGIN
      INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role,
        aud,
        confirmation_token,
        recovery_token
      ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'test_user_' || i || '@test.com',
        v_encrypted_password,
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object('full_name', v_nicknames[i]),
        false,
        'authenticated',
        'authenticated',
        '',
        ''
      );
      
      RAISE NOTICE '✅ auth.users에 유저 % 생성 완료: %', i, v_nicknames[i];
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '⚠️ auth.users 생성 실패 (유저 %): %', i, SQLERRM;
        -- auth.users 생성 실패해도 계속 진행
    END;
    
    -- profiles에 프로필 생성
    BEGIN
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
        ROUND(v_weights[i] / POWER(v_heights[i] / 100.0, 2), 2), -- BMI 계산
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
      
      RAISE NOTICE '✅ profiles에 유저 % 프로필 생성 완료: %', i, v_nicknames[i];
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '❌ profiles 생성 실패 (유저 %): %', i, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT 20, v_user_ids;
END;
$$;

-- 함수 실행
SELECT * FROM create_test_users();

-- 생성된 유저 확인
SELECT 
  p.id,
  p.nickname,
  p.chart_number,
  p.age,
  p.gender,
  p.height,
  p.weight,
  p.bmi,
  p.role,
  u.email
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.nickname IN (
  '김철수', '이영희', '박민수', '최지영', '정수진',
  '강호영', '윤서연', '임동현', '한소희', '조민준',
  '오지훈', '신유진', '류태현', '배수빈', '전혜진',
  '남도현', '문지은', '송재호', '유나영', '홍성민'
)
ORDER BY p.created_at DESC;

SELECT '✅ 테스트 유저 생성 스크립트 실행 완료!' AS result;
