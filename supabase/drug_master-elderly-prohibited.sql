-- DUR 노인금기 품목 데이터를 drug_master에 반영
-- 원본: 노인금기약물(수정필).csv 2025.06
-- 변환: scripts/dur_elderly_prohibited_utf8.csv (UTF-8, 593건)
-- 노인금기 = 노인 처방 자체를 피해야 하는 약물 (노인주의보다 강한 등급)

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS elderly_prohibited        BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS elderly_prohibited_detail TEXT;

COMMENT ON COLUMN drug_master.elderly_prohibited        IS 'DUR 노인금기 여부 (건강보험심사평가원) - 노인 처방 금지';
COMMENT ON COLUMN drug_master.elderly_prohibited_detail IS 'DUR 노인금기 상세 사유';

CREATE INDEX IF NOT EXISTS idx_drug_master_elderly_prohibited ON drug_master(elderly_prohibited);

-- 데이터는 scripts/import-elderly-prohibited.ts 스크립트로 일괄 업로드
