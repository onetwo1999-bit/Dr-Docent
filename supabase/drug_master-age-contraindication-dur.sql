-- DUR 연령금기약물 데이터를 drug_master에 반영
-- 원본: 연령금기DUR약물.csv (CP949)
-- 변환: scripts/dur_age_contraindication_dur_utf8.csv (UTF-8, 3118건)
-- 특정연령단위: "세 (3)" → "세",  연령처리조건: "이상 (4)" → "이상" 으로 정제

-- 이미 supabase/drug_master-age-contraindication.sql 실행으로 컬럼 존재 시 이 파일 불필요
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_contraindication        BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_limit_value             TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_limit_unit              TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_limit_condition         TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_contraindication_detail TEXT;

COMMENT ON COLUMN drug_master.age_contraindication        IS 'DUR 연령금기 여부 (건강보험심사평가원)';
COMMENT ON COLUMN drug_master.age_limit_value             IS 'DUR 연령금기 기준 나이 (예: 18, 65)';
COMMENT ON COLUMN drug_master.age_limit_unit              IS 'DUR 연령금기 단위 (세/개월/주)';
COMMENT ON COLUMN drug_master.age_limit_condition         IS 'DUR 연령금기 조건 (미만/이하/이상)';
COMMENT ON COLUMN drug_master.age_contraindication_detail IS 'DUR 연령금기 상세 사유';

CREATE INDEX IF NOT EXISTS idx_drug_master_age_contraindication ON drug_master(age_contraindication);

-- 데이터는 scripts/import-age-contraindication-dur.ts 스크립트로 일괄 업로드
