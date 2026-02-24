-- DUR 어린이주의약물 데이터를 drug_master에 반영
-- 원본: 어린이주의약물DUR.csv (CP949)
-- 변환: scripts/dur_child_caution_utf8.csv (UTF-8, 3822건)
-- 기준 연령: 특정연령 + 단위(세/개월/주) + 조건(미만/이하/이상)

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS child_caution        BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS child_caution_detail TEXT;

COMMENT ON COLUMN drug_master.child_caution        IS 'DUR 어린이주의 여부 (건강보험심사평가원)';
COMMENT ON COLUMN drug_master.child_caution_detail IS 'DUR 어린이주의 상세 사유';

CREATE INDEX IF NOT EXISTS idx_drug_master_child_caution ON drug_master(child_caution);

-- 연령 관련 공통 컬럼(age_limit_value / age_limit_unit / age_limit_condition)은
-- supabase/drug_master-age-contraindication.sql 에서 이미 추가됨.
-- 해당 파일을 먼저 실행하거나, 아래 주석을 해제 후 실행하세요.
-- ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_limit_value     TEXT;
-- ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_limit_unit      TEXT;
-- ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_limit_condition TEXT;

-- 데이터는 scripts/import-child-caution.ts 스크립트로 일괄 업로드
