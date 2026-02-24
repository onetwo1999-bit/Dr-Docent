-- DUR 노인주의(해열진통소염제) 품목 데이터를 drug_master에 반영
-- 원본: 건강보험심사평가원 DUR 노인주의(해열진통소염제) 품목리스트 2025.06
-- 변환: scripts/dur_elderly_nsaid_utf8.csv (UTF-8, 1083건)

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS elderly_nsaid_caution        BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS elderly_nsaid_caution_detail  TEXT;

COMMENT ON COLUMN drug_master.elderly_nsaid_caution        IS 'DUR 노인주의(해열진통소염제) 여부 (건강보험심사평가원)';
COMMENT ON COLUMN drug_master.elderly_nsaid_caution_detail IS 'DUR 노인주의(해열진통소염제) 상세 주의사항';

CREATE INDEX IF NOT EXISTS idx_drug_master_elderly_nsaid ON drug_master(elderly_nsaid_caution);

-- 데이터는 scripts/import-elderly-nsaid.ts 스크립트로 일괄 업로드
