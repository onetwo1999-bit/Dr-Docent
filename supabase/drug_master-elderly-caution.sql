-- DUR 노인주의 품목 데이터를 drug_master에 elderly_caution 컬럼으로 반영
-- 원본: 건강보험심사평가원 DUR 노인주의 품목리스트 2025.06
-- 변환: scripts/dur_elderly_caution_utf8.csv (UTF-8, 572건)

-- 1) drug_master에 노인주의 관련 컬럼 추가
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS elderly_caution      BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS elderly_caution_detail TEXT;

COMMENT ON COLUMN drug_master.elderly_caution        IS 'DUR 노인주의 품목 여부 (건강보험심사평가원)';
COMMENT ON COLUMN drug_master.elderly_caution_detail IS 'DUR 노인주의 상세 주의사항';

-- 2) 인덱스
CREATE INDEX IF NOT EXISTS idx_drug_master_elderly_caution ON drug_master(elderly_caution);

-- 3) 데이터는 scripts/import-elderly-caution.ts 스크립트로 일괄 업로드
