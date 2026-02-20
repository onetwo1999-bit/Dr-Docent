-- =====================================================
-- search_logs: 유저 검색 빈도 기록 (학습형 하이브리드 검색용)
-- =====================================================

CREATE TABLE IF NOT EXISTS search_logs (
  keyword TEXT NOT NULL PRIMARY KEY,
  call_count INT NOT NULL DEFAULT 1,
  last_called_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE search_logs IS '의약품 검색 키워드별 호출 횟수. 5회 이상이면 API 결과를 drug_master에 영구 캐싱.';

-- 키워드 검색 시 호출: 1회면 INSERT, 있으면 call_count+1, last_called_at 갱신 후 현재 call_count 반환
CREATE OR REPLACE FUNCTION increment_search_log(p_keyword TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INT;
BEGIN
  INSERT INTO search_logs (keyword, call_count, last_called_at)
  VALUES (TRIM(p_keyword), 1, NOW())
  ON CONFLICT (keyword) DO UPDATE
  SET call_count = search_logs.call_count + 1,
      last_called_at = NOW()
  RETURNING call_count INTO new_count;
  RETURN COALESCE(new_count, 1);
END;
$$;

ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
-- 서버(service_role)만 쓰는 로그 테이블: 정책 없음.
