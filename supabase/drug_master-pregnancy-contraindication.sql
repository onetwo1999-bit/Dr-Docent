-- DUR 임부금기 품목 데이터를 drug_master에 반영
-- 원본: 건강보험심사평가원 DUR 임부금기 품목리스트 2025.06
-- 변환: scripts/dur_pregnancy_contraindication_utf8.csv (UTF-8, 19015건)
-- 금기등급: 1 (절대금기), 2 (상대금기/안전성 미확립), M (병용금기)

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS preg_contraindication       BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS preg_contraindication_grade  TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS preg_contraindication_detail TEXT;

COMMENT ON COLUMN drug_master.preg_contraindication        IS 'DUR 임부금기 여부 (건강보험심사평가원)';
COMMENT ON COLUMN drug_master.preg_contraindication_grade  IS 'DUR 임부금기 등급: 1=절대금기, 2=안전성미확립, M=병용금기';
COMMENT ON COLUMN drug_master.preg_contraindication_detail IS 'DUR 임부금기 상세 사유';

CREATE INDEX IF NOT EXISTS idx_drug_master_preg_contraindication ON drug_master(preg_contraindication);
CREATE INDEX IF NOT EXISTS idx_drug_master_preg_grade ON drug_master(preg_contraindication_grade);

-- 데이터는 scripts/import-pregnancy-contraindication.ts 스크립트로 일괄 업로드
