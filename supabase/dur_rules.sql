-- ================================================================
-- DUR 규칙 통합 테이블 (dur_rules)
-- 모든 DUR 카테고리(임부금기, 연령금기, 노인주의 등)를 단일 테이블에 적재
-- 업로드: scripts/upload_dur_rules.py
-- ================================================================

CREATE TABLE IF NOT EXISTS dur_rules (
    id                   BIGSERIAL PRIMARY KEY,

    -- ── 공통 식별자 ─────────────────────────────────────────
    dur_type             TEXT        NOT NULL,  -- 파일명 기반 분류 (예: 임부금기, 연령금기_DUR)
    item_seq             TEXT        NOT NULL,  -- 품목기준코드
    item_name            TEXT,                  -- 제품명
    ingr_name            TEXT,                  -- 주성분명 (정제)
    ingr_name_raw        TEXT,                  -- 주성분명 (원본)
    ingr_code            TEXT,                  -- 성분코드
    company_name         TEXT,                  -- 업체명
    reimbursement        TEXT,                  -- 급여구분

    -- ── 고시/공고 정보 ───────────────────────────────────────
    notice_no            TEXT,                  -- 고시/공고번호
    notice_date          TEXT,                  -- 고시/공고일자

    -- ── 금기·주의 상세 (통합) ────────────────────────────────
    restriction_reason   TEXT,                  -- 금기/주의 사유 (카테고리별 detail 통합)

    -- ── 연령 관련 (연령금기·어린이주의) ──────────────────────
    age_limit_value      TEXT,                  -- 기준 나이
    age_limit_unit       TEXT,                  -- 단위 (세/개월/주)
    age_limit_condition  TEXT,                  -- 조건 (미만/이하/이상)

    -- ── 임부금기 ─────────────────────────────────────────────
    preg_grade           TEXT,                  -- 임부금기 등급 (1=절대금기, 2=상대금기)

    -- ── 용량주의 ─────────────────────────────────────────────
    max_daily_dose_desc  TEXT,                  -- 1일 최대용량 설명
    max_daily_dose_mg    TEXT,                  -- 1일 최대용량(mg)

    -- ── 지속기간주의 ─────────────────────────────────────────
    max_dosage_days      TEXT,                  -- 최대 투여 가능 일수

    -- ── 효능군 중복주의 ──────────────────────────────────────
    therapeutic_group    TEXT,                  -- 효능군명
    group_classification TEXT,                  -- 효능군 분류코드

    -- ── 메타 ─────────────────────────────────────────────────
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),

    -- ── 복합 UNIQUE 제약 (upsert 기준) ───────────────────────
    CONSTRAINT dur_rules_uq UNIQUE (item_seq, dur_type)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_dur_rules_dur_type   ON dur_rules(dur_type);
CREATE INDEX IF NOT EXISTS idx_dur_rules_item_seq   ON dur_rules(item_seq);
CREATE INDEX IF NOT EXISTS idx_dur_rules_ingr_name  ON dur_rules(ingr_name);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_dur_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_dur_rules_updated_at ON dur_rules;
CREATE TRIGGER trg_dur_rules_updated_at
    BEFORE UPDATE ON dur_rules
    FOR EACH ROW EXECUTE FUNCTION update_dur_rules_updated_at();

COMMENT ON TABLE  dur_rules                    IS 'DUR 의약품 안전사용 규칙 통합 테이블';
COMMENT ON COLUMN dur_rules.dur_type           IS '분류: 임부금기 / 연령금기 / 노인주의 / 어린이주의 / 용량주의 / 지속기간주의 / 효능군중복';
COMMENT ON COLUMN dur_rules.restriction_reason IS '금기/주의 상세 사유 (카테고리별 detail 컬럼 통합)';
