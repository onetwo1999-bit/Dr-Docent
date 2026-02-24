-- DUR 효능군중복주의 품목 데이터를 drug_master에 반영
-- 원본: 효능군중복주의약물.csv 2025.06
-- 변환: scripts/dur_therapeutic_duplication_utf8.csv (UTF-8, 12147건)
-- 참고: 원본 파일의 성분코드↔성분명 컬럼 헤더 뒤바뀜 → 변환 시 교정 완료

ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS therapeutic_duplication_caution BOOLEAN DEFAULT false;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS therapeutic_group               TEXT;
ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS group_classification            TEXT;

COMMENT ON COLUMN drug_master.therapeutic_duplication_caution IS 'DUR 효능군중복주의 여부 (건강보험심사평가원)';
COMMENT ON COLUMN drug_master.therapeutic_group               IS 'DUR 효능군 (예: 혈압강하작용의약품)';
COMMENT ON COLUMN drug_master.group_classification            IS 'DUR 그룹구분 (예: Group 10)';

CREATE INDEX IF NOT EXISTS idx_drug_master_therapeutic_dup ON drug_master(therapeutic_duplication_caution);

-- 데이터는 scripts/import-therapeutic-duplication.ts 스크립트로 일괄 업로드
