-- ================================================================
-- 닥터 도슨 신체 컨디션 모니터링 엔진 — 3개 참조 테이블
-- 업로드: scripts/upload_health_engine.py
-- ================================================================

-- ── 1. 건강검진 표준 벤치마크 ──────────────────────────────────
-- 성별·연령대별 신체 지표 평균/표준편차 (100만 건 검진 데이터 집계)
-- 활용: 사용자 수치와 동일 인구집단 표준값 간의 거리(z-score) 산출

CREATE TABLE IF NOT EXISTS health_benchmarks (
    id                    BIGSERIAL PRIMARY KEY,

    -- 인구통계 세그먼트
    gender                TEXT NOT NULL,    -- 남성 / 여성
    age_group_code        INT  NOT NULL,    -- 5~18 (5세단위)
    age_group_label       TEXT NOT NULL,    -- 예: 60~64세
    sample_count          INT  DEFAULT 0,   -- 집계 표본 수

    -- 신체 계측
    height_avg            NUMERIC(6,2),  height_std            NUMERIC(6,2),
    weight_avg            NUMERIC(6,2),  weight_std            NUMERIC(6,2),
    bmi_avg               NUMERIC(5,2),  bmi_std               NUMERIC(5,2),
    waist_avg             NUMERIC(6,2),  waist_std             NUMERIC(6,2),

    -- 혈압
    systolic_bp_avg       NUMERIC(6,2),  systolic_bp_std       NUMERIC(6,2),
    diastolic_bp_avg      NUMERIC(6,2),  diastolic_bp_std      NUMERIC(6,2),

    -- 혈당·지질
    fasting_glucose_avg   NUMERIC(7,2),  fasting_glucose_std   NUMERIC(7,2),
    total_cholesterol_avg NUMERIC(7,2),  total_cholesterol_std NUMERIC(7,2),
    hdl_cholesterol_avg   NUMERIC(6,2),  hdl_cholesterol_std   NUMERIC(6,2),
    ldl_cholesterol_avg   NUMERIC(7,2),  ldl_cholesterol_std   NUMERIC(7,2),
    triglyceride_avg      NUMERIC(8,2),  triglyceride_std      NUMERIC(8,2),

    -- 혈액·간
    hemoglobin_avg        NUMERIC(5,2),  hemoglobin_std        NUMERIC(5,2),
    ast_avg               NUMERIC(7,2),  ast_std               NUMERIC(7,2),
    alt_avg               NUMERIC(7,2),  alt_std               NUMERIC(7,2),
    gamma_gtp_avg         NUMERIC(8,2),  gamma_gtp_std         NUMERIC(8,2),

    -- 메타
    data_year             INT  DEFAULT 2024,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT health_benchmarks_uq UNIQUE (gender, age_group_code)
);

CREATE INDEX IF NOT EXISTS idx_hb_gender_age ON health_benchmarks(gender, age_group_code);
COMMENT ON TABLE  health_benchmarks             IS '성별·연령대별 건강검진 표준 벤치마크 (100만 건 집계)';
COMMENT ON COLUMN health_benchmarks.bmi_avg     IS 'BMI = 체중(kg) / 신장(m)²';
COMMENT ON COLUMN health_benchmarks.sample_count IS '집계 대상 표본 수 (결측 제외)';


-- ── 2. 암 발생 통계 참조 ──────────────────────────────────────
-- 국립암센터 암발생 통계 (1999~2023)
-- 활용: 인구통계 세그먼트별 암 발생 빈도 인지 → 취약 구간 모니터링

CREATE TABLE IF NOT EXISTS cancer_incidence_reference (
    id                BIGSERIAL PRIMARY KEY,

    cancer_type       TEXT NOT NULL,    -- 한글 암종명 (예: 위)
    kcd_code          TEXT,             -- 국제질병분류 코드 (예: C16)
    gender            TEXT NOT NULL,    -- 전체 / 남성 / 여성
    age_group_label   TEXT NOT NULL,    -- 예: 60~64세
    incidence_year    INT  NOT NULL,    -- 발생연도
    patient_count     INT  DEFAULT 0,   -- 발생자수
    incidence_rate    NUMERIC(10,2),    -- 조발생률 (인구 10만 명당)

    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT cancer_incidence_uq UNIQUE (cancer_type, gender, age_group_label, incidence_year)
);

CREATE INDEX IF NOT EXISTS idx_ci_type_gender  ON cancer_incidence_reference(cancer_type, gender);
CREATE INDEX IF NOT EXISTS idx_ci_year         ON cancer_incidence_reference(incidence_year);
CREATE INDEX IF NOT EXISTS idx_ci_age          ON cancer_incidence_reference(age_group_label);
COMMENT ON TABLE  cancer_incidence_reference               IS '국립암센터 암발생 통계 1999~2023';
COMMENT ON COLUMN cancer_incidence_reference.incidence_rate IS '조발생률: 인구 10만 명당 발생자수';


-- ── 3. 암 생존율 참조 ────────────────────────────────────────
-- 국립암센터 24개 암종 5년 상대생존율 (1993~2023)
-- 활용: 컨디션 이상 감지 시 이성적·긍정적 가이드 참조 데이터

CREATE TABLE IF NOT EXISTS cancer_survival_reference (
    id                      BIGSERIAL PRIMARY KEY,

    cancer_type             TEXT NOT NULL,    -- 한글 암종명
    kcd_code                TEXT,             -- 국제질병분류 코드
    gender                  TEXT NOT NULL,    -- 전체 / 남성 / 여성
    period                  TEXT NOT NULL,    -- 발생기간 (예: 2019-2023)
    is_latest               BOOLEAN DEFAULT false, -- 최신 기간 여부
    patient_count           INT  DEFAULT 0,   -- 환자수
    five_year_survival_rate NUMERIC(5,2),     -- 5년 상대생존율 (%)

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT cancer_survival_uq UNIQUE (cancer_type, gender, period)
);

CREATE INDEX IF NOT EXISTS idx_cs_type_gender ON cancer_survival_reference(cancer_type, gender);
CREATE INDEX IF NOT EXISTS idx_cs_latest      ON cancer_survival_reference(is_latest);
COMMENT ON TABLE  cancer_survival_reference                    IS '국립암센터 24개 암종 5년 상대생존율 1993~2023';
COMMENT ON COLUMN cancer_survival_reference.is_latest          IS '2019-2023 기간 데이터 여부 (최신 생존율)';
COMMENT ON COLUMN cancer_survival_reference.five_year_survival_rate IS '5년 상대생존율 (%) — 예: 갑상선 100.6%';


-- ── 공통 updated_at 트리거 ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_health_engine_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_hb_updated_at ON health_benchmarks;
CREATE TRIGGER trg_hb_updated_at
    BEFORE UPDATE ON health_benchmarks
    FOR EACH ROW EXECUTE FUNCTION update_health_engine_updated_at();

DROP TRIGGER IF EXISTS trg_ci_updated_at ON cancer_incidence_reference;
CREATE TRIGGER trg_ci_updated_at
    BEFORE UPDATE ON cancer_incidence_reference
    FOR EACH ROW EXECUTE FUNCTION update_health_engine_updated_at();

DROP TRIGGER IF EXISTS trg_cs_updated_at ON cancer_survival_reference;
CREATE TRIGGER trg_cs_updated_at
    BEFORE UPDATE ON cancer_survival_reference
    FOR EACH ROW EXECUTE FUNCTION update_health_engine_updated_at();
