-- DUR 연령금기 품목 데이터를 drug_master에 반영
-- 원본: 건강보험심사평가원 DUR 연령금기 품목리스트 2025.06
-- 변환: scripts/dur_age_contraindication_utf8.csv (UTF-8, 2890건)
-- 연령조건 예시: "12 세 미만" / "18 세 이하" / "65 세 이상"

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_contraindication        BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_limit_value             TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_limit_unit              TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_limit_condition         TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS age_contraindication_detail TEXT;

COMMENT ON COLUMN drug_master.age_contraindication        IS 'DUR 연령금기 여부 (건강보험심사평가원)';
COMMENT ON COLUMN drug_master.age_limit_value             IS 'DUR 연령금기 기준 나이 (예: 12)';
COMMENT ON COLUMN drug_master.age_limit_unit              IS 'DUR 연령금기 단위 (세/개월)';
COMMENT ON COLUMN drug_master.age_limit_condition         IS 'DUR 연령금기 조건 (미만/이하/이상)';
COMMENT ON COLUMN drug_master.age_contraindication_detail IS 'DUR 연령금기 상세 사유';

CREATE INDEX IF NOT EXISTS idx_drug_master_age_contraindication ON drug_master(age_contraindication);

-- 데이터는 scripts/import-age-contraindication.ts 스크립트로 일괄 업로드
