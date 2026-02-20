-- drug_master: 캐시 시 핵심 필드만 저장 (PRDUCT, MTRAL_NM, ENTRPS, EE_DOC_DATA, NB_DOC_DATA)
-- 기존: product_name, main_ingredient, ingredient_code
-- 추가: company_name(ENTRPS), ee_doc_data(효능), nb_doc_data(주의사항)

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS ee_doc_data TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS nb_doc_data TEXT;

CREATE INDEX IF NOT EXISTS idx_drug_master_company_name ON drug_master(company_name);
COMMENT ON COLUMN drug_master.company_name IS 'ENTRPS 업체명';
COMMENT ON COLUMN drug_master.ee_doc_data IS '효능';
COMMENT ON COLUMN drug_master.nb_doc_data IS '주의사항';
