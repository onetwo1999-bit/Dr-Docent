-- drug_master: e-약은요 품목기준코드 저장용 (hydrate-easy-drug.ts 매핑)
-- ingredient_code 대신 item_seq 사용 시 이 마이그레이션 실행

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS item_seq TEXT;
CREATE INDEX IF NOT EXISTS idx_drug_master_item_seq ON drug_master(item_seq);
COMMENT ON COLUMN drug_master.item_seq IS 'e-약은요 품목기준코드(itemSeq)';
