-- =====================================================
-- 회원가입 시 profiles 자동 생성 트리거
-- auth.users INSERT 후 public.profiles에 자동 삽입.
-- nickname 컬럼 유무를 동적으로 확인해 안전하게 처리.
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nickname TEXT;
  v_has_nickname BOOLEAN;
BEGIN
  -- nickname 컬럼 존재 여부 확인
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'nickname'
  ) INTO v_has_nickname;

  v_nickname := COALESCE(NEW.raw_user_meta_data->>'nickname', '');

  IF v_has_nickname THEN
    INSERT INTO public.profiles (id, nickname, updated_at)
    VALUES (NEW.id, v_nickname, NOW())
    ON CONFLICT (id) DO UPDATE SET
      nickname   = COALESCE(EXCLUDED.nickname, public.profiles.nickname),
      updated_at = NOW();
  ELSE
    -- nickname 컬럼이 아직 없으면 id만 삽입
    INSERT INTO public.profiles (id, updated_at)
    VALUES (NEW.id, NOW())
    ON CONFLICT (id) DO UPDATE SET
      updated_at = NOW();
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- 트리거 실패가 가입 자체를 막지 않도록 예외를 삼킴 (로그만 남김)
  RAISE WARNING '[handle_new_user] profiles 삽입 실패 (user_id: %): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ✅ 완료. signUp 시 options.data.nickname → profiles.nickname 에 반영됩니다.
--    nickname 컬럼이 없는 환경에서도 가입이 중단되지 않습니다.
