-- DUR 용량주의 품목 데이터를 drug_master에 반영
-- 원본: 용량주의약물(수정필).csv 2025.06
-- 변환: scripts/dur_dosage_limit_utf8.csv (UTF-8, 6710건)

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS dosage_limit_caution     BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS max_daily_dose_desc       TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS max_daily_dose_mg         TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS component_content_mg      TEXT;

COMMENT ON COLUMN drug_master.dosage_limit_caution   IS 'DUR 용량주의 여부 (건강보험심사평가원)';
COMMENT ON COLUMN drug_master.max_daily_dose_desc    IS 'DUR 1일 최대 투여량 설명 (예: 아세트아미노펜으로써 4000mg)';
COMMENT ON COLUMN drug_master.max_daily_dose_mg      IS 'DUR 1일 최대 투여 기준량 (mg 수치)';
COMMENT ON COLUMN drug_master.component_content_mg   IS 'DUR 점검기준 성분 함량 총함량 (mg)';

CREATE INDEX IF NOT EXISTS idx_drug_master_dosage_limit ON drug_master(dosage_limit_caution);

-- 데이터는 scripts/import-dosage-limit.ts 스크립트로 일괄 업로드
