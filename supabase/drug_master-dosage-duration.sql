-- DUR 투여기간주의 품목 데이터를 drug_master에 반영
-- 원본: 투여기간주의약물(수정필).csv 2025.06
-- 변환: scripts/dur_dosage_duration_utf8.csv (UTF-8, 410건)

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS dosage_duration_caution   BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS max_dosage_days           TEXT;

COMMENT ON COLUMN drug_master.dosage_duration_caution IS 'DUR 투여기간주의 여부 (건강보험심사평가원)';
COMMENT ON COLUMN drug_master.max_dosage_days         IS 'DUR 최대 투여 가능 일수 (예: 28)';

CREATE INDEX IF NOT EXISTS idx_drug_master_dosage_duration ON drug_master(dosage_duration_caution);

-- 데이터는 scripts/import-dosage-duration.ts 스크립트로 일괄 업로드
