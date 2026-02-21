-- drug_master: AI 라벨링용 컬럼 (category, simple_desc)
-- label-drug-master-ai.ts 스크립트에서 Claude 3.5 Sonnet으로 ee_doc_data 기반 생성

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS simple_desc TEXT;

CREATE INDEX IF NOT EXISTS idx_drug_master_category ON drug_master(category);
COMMENT ON COLUMN drug_master.category IS 'AI 분류: 위장약, 해열진통제 등 한 단어';
COMMENT ON COLUMN drug_master.simple_desc IS 'AI 생성: 시니어 눈높이 한 줄 요약';
