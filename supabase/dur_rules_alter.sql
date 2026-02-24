-- dur_rules 테이블 컬럼 추가 마이그레이션
-- 기존 컬럼: id, item_seq, item_name, dur_type, ingr_name, restriction_reason, created_at
-- 아래 컬럼들을 추가합니다.

ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS ingr_name_raw        TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS ingr_code            TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS company_name         TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS reimbursement        TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS notice_no            TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS notice_date          TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS age_limit_value      TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS age_limit_unit       TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS age_limit_condition  TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS preg_grade           TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS max_daily_dose_mg    TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS max_dosage_days      TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS therapeutic_group    TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS group_classification TEXT;
ALTER TABLE dur_rules ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW();

-- UNIQUE 제약 (item_seq + dur_type 기준 upsert)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'dur_rules_uq' AND conrelid = 'dur_rules'::regclass
    ) THEN
        ALTER TABLE dur_rules ADD CONSTRAINT dur_rules_uq UNIQUE (item_seq, dur_type);
    END IF;
END$$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_dur_rules_dur_type  ON dur_rules(dur_type);
CREATE INDEX IF NOT EXISTS idx_dur_rules_item_seq  ON dur_rules(item_seq);
CREATE INDEX IF NOT EXISTS idx_dur_rules_ingr_name ON dur_rules(ingr_name);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_dur_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_dur_rules_updated_at ON dur_rules;
CREATE TRIGGER trg_dur_rules_updated_at
    BEFORE UPDATE ON dur_rules
    FOR EACH ROW EXECUTE FUNCTION update_dur_rules_updated_at();
