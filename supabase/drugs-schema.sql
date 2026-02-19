-- =====================================================
-- drugs: 식약처 의약품 개요정보(e약은요) API 결과 저장
-- 품목기준코드(item_seq) 기준 유니크, API 조회 결과 자동 저장용
-- =====================================================

CREATE TABLE IF NOT EXISTS drugs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_seq TEXT NOT NULL UNIQUE,
  product_name TEXT,
  company_name TEXT,
  efficacy TEXT,
  use_method TEXT,
  precautions_warn TEXT,
  precautions TEXT,
  interaction TEXT,
  side_effect TEXT,
  storage_method TEXT,
  item_image TEXT,
  ingredients TEXT,
  open_de TEXT,
  update_de TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drugs_item_seq ON drugs(item_seq);
CREATE INDEX IF NOT EXISTS idx_drugs_product_name ON drugs(product_name);

ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
-- 정책 없음: anon/authenticated 접근 불가. 서버만 createAdminClient()로 RLS 우회하여 insert/upsert.

COMMENT ON TABLE drugs IS '식약처 e약은요 API 조회 결과. 제품명 검색 시 성공한 항목을 자동 저장.';
COMMENT ON COLUMN drugs.ingredients IS '주성분/성분명 (API에서 제공 시 저장)';
