-- DUR 임부금기약물(2024-06-25 버전) 데이터를 drug_master에 반영
-- 원본: 임부금기약물DUR(수정필_20240625.csv
-- 변환: scripts/dur_preg_contraindication2_utf8.csv (UTF-8, 19271건)
-- 기존 preg_contraindication 컬럼과 동일 구조 — 중복 없이 upsert 방식으로 적재

-- 이미 supabase/drug_master-pregnancy-contraindication.sql 실행 후 컬럼이 있으면 이 파일 불필요
-- 신규 환경에서만 실행
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS preg_contraindication       BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS preg_contraindication_grade  TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS preg_contraindication_detail TEXT;

COMMENT ON COLUMN drug_master.preg_contraindication        IS 'DUR 임부금기 여부 (건강보험심사평가원)';
COMMENT ON COLUMN drug_master.preg_contraindication_grade  IS 'DUR 임부금기 등급: 1=절대금기, 2=안전성미확립, M=병용금기';
COMMENT ON COLUMN drug_master.preg_contraindication_detail IS 'DUR 임부금기 상세 사유';

CREATE INDEX IF NOT EXISTS idx_drug_master_preg_contraindication ON drug_master(preg_contraindication);
CREATE INDEX IF NOT EXISTS idx_drug_master_preg_grade ON drug_master(preg_contraindication_grade);

-- 데이터는 scripts/import-preg-contraindication2.ts 스크립트로 일괄 업로드
