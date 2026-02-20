-- 선택: drug_master upsert(인기 키워드 영구 캐싱)를 위해 product_name 유니크 추가
-- 기존에 product_name 중복이 있으면 아래 "중복 제거" 쿼리 먼저 실행 후, 유니크 인덱스 생성.

-- 1) 중복 제거 (필요 시만 실행)
-- DELETE FROM drug_master a USING drug_master b WHERE a.ctid < b.ctid AND a.product_name = b.product_name;

-- 2) 유니크 인덱스 생성 (이후 앱에서 upsert 시 동일 제품명이면 갱신)
CREATE UNIQUE INDEX IF NOT EXISTS idx_drug_master_product_name_unique ON drug_master (product_name);
