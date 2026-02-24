-- ================================================================
-- 다빈도 질병 통계 테이블 (disease_stats)
-- 출처: 건강보험심사평가원 다빈도질병통계 2024 (양방/한방, 입원/외래)
-- 업로드: scripts/upload_disease_stats.py
-- ================================================================

CREATE TABLE IF NOT EXISTS disease_stats (
    id                  BIGSERIAL PRIMARY KEY,

    -- ── 분류 ───────────────────────────────────────────────────
    medical_type        TEXT        NOT NULL,  -- 양방 / 한방
    visit_type          TEXT        NOT NULL,  -- 입원 / 외래
    kcd_code            TEXT        NOT NULL,  -- 질병분류코드 (KCD)
    disease_name        TEXT,                  -- 3단 질병명

    -- ── 진료 통계 ──────────────────────────────────────────────
    patient_count       BIGINT      DEFAULT 0, -- 환자수
    visit_days          BIGINT      DEFAULT 0, -- 내원일수
    claim_count         BIGINT      DEFAULT 0, -- 청구건수

    -- ── 비용 지표 ──────────────────────────────────────────────
    total_cost          BIGINT      DEFAULT 0, -- 요양급여비용총액 (천원)
    insurer_paid        BIGINT      DEFAULT 0, -- 보험자부담금 (천원)
    self_paid_estimated BIGINT      DEFAULT 0, -- 예상 본인부담금 (total_cost - insurer_paid)

    -- ── AI 생성 컬럼 ────────────────────────────────────────────
    symptom_keywords    TEXT,                  -- Claude Haiku 생성 일상 증상 키워드

    -- ── 메타 ───────────────────────────────────────────────────
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    -- ── Upsert 기준 UNIQUE 제약 ─────────────────────────────────
    CONSTRAINT disease_stats_uq UNIQUE (kcd_code, medical_type, visit_type)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_disease_stats_kcd_code    ON disease_stats(kcd_code);
CREATE INDEX IF NOT EXISTS idx_disease_stats_types       ON disease_stats(medical_type, visit_type);
CREATE INDEX IF NOT EXISTS idx_disease_stats_total_cost  ON disease_stats(total_cost DESC);
CREATE INDEX IF NOT EXISTS idx_disease_stats_disease_name ON disease_stats(disease_name);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_disease_stats_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_disease_stats_updated_at ON disease_stats;
CREATE TRIGGER trg_disease_stats_updated_at
    BEFORE UPDATE ON disease_stats
    FOR EACH ROW EXECUTE FUNCTION update_disease_stats_updated_at();

COMMENT ON TABLE  disease_stats                        IS '다빈도질병통계 2024 (건강보험심사평가원)';
COMMENT ON COLUMN disease_stats.medical_type           IS '진료 구분: 양방 / 한방';
COMMENT ON COLUMN disease_stats.visit_type             IS '입원/외래 구분';
COMMENT ON COLUMN disease_stats.kcd_code               IS '한국 표준 질병·사인 분류 코드 (KCD)';
COMMENT ON COLUMN disease_stats.total_cost             IS '요양급여비용총액 (단위: 천원)';
COMMENT ON COLUMN disease_stats.self_paid_estimated    IS '예상 본인부담금 = total_cost - insurer_paid';
COMMENT ON COLUMN disease_stats.symptom_keywords       IS 'AI 생성: 3040·시니어용 일상 증상 키워드';
