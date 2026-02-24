-- ============================================================
-- supplement_master 테이블 생성
-- 식품의약품안전처_건강기능식품영양성분정보 데이터 전용
-- 실행: Supabase SQL Editor에서 이 파일 내용 전체 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS supplement_master (
    id                      BIGSERIAL PRIMARY KEY,

    -- ── 기본 식별자 ──────────────────────────────────────
    food_code               TEXT UNIQUE NOT NULL,   -- 식품코드 (UNIQUE KEY)
    product_reg_no          TEXT,                   -- 품목제조신고번호
    food_name               TEXT NOT NULL,          -- 식품명

    -- ── 분류 체계 ────────────────────────────────────────
    data_type_code          TEXT,   -- 데이터구분코드
    data_type_name          TEXT,   -- 데이터구분명
    food_origin_code        TEXT,   -- 식품기원코드
    food_origin_name        TEXT,   -- 식품기원명
    food_major_code         TEXT,   -- 식품대분류코드
    food_major_name         TEXT,   -- 식품대분류명
    rep_food_code           TEXT,   -- 대표식품코드
    rep_food_name           TEXT,   -- 대표식품명
    food_mid_code           TEXT,   -- 식품중분류코드
    food_mid_name           TEXT,   -- 식품중분류명
    food_sub_code           TEXT,   -- 식품소분류코드
    food_sub_name           TEXT,   -- 식품소분류명
    food_detail_code        TEXT,   -- 식품세분류코드
    food_detail_name        TEXT,   -- 식품세분류명
    type_name               TEXT,   -- 유형명

    -- ── 제공량 기준 ──────────────────────────────────────
    serving_unit            TEXT,   -- 영양성분제공단위량
    serving_amount          TEXT,   -- 1회분량
    serving_weight          TEXT,   -- 1회분량중량/부피
    daily_intake_count      TEXT,   -- 1일섭취횟수
    intake_target           TEXT,   -- 섭취대상
    food_weight             TEXT,   -- 식품중량/부피

    -- ── 기본 영양소 ──────────────────────────────────────
    calories                DOUBLE PRECISION,   -- 에너지(kcal)
    moisture_g              DOUBLE PRECISION,   -- 수분(g)
    protein_g               DOUBLE PRECISION,   -- 단백질(g)
    fat_g                   DOUBLE PRECISION,   -- 지방(g)
    ash_g                   DOUBLE PRECISION,   -- 회분(g)
    carbs_g                 DOUBLE PRECISION,   -- 탄수화물(g)
    sugar_g                 DOUBLE PRECISION,   -- 당류(g)
    dietary_fiber_g         DOUBLE PRECISION,   -- 식이섬유(g)

    -- ── 무기질 ───────────────────────────────────────────
    calcium_mg              DOUBLE PRECISION,   -- 칼슘(mg)
    iron_mg                 DOUBLE PRECISION,   -- 철(mg)
    phosphorus_mg           DOUBLE PRECISION,   -- 인(mg)
    potassium_mg            DOUBLE PRECISION,   -- 칼륨(mg)
    sodium_mg               DOUBLE PRECISION,   -- 나트륨(mg)

    -- ── 비타민 ───────────────────────────────────────────
    vitamin_a_ug            DOUBLE PRECISION,   -- 비타민 A(μg RAE)
    retinol_ug              DOUBLE PRECISION,   -- 레티놀(μg)
    beta_carotene_ug        DOUBLE PRECISION,   -- 베타카로틴(μg)
    thiamine_mg             DOUBLE PRECISION,   -- 티아민(mg)
    riboflavin_mg           DOUBLE PRECISION,   -- 리보플라빈(mg)
    niacin_mg               DOUBLE PRECISION,   -- 니아신(mg)
    vitamin_c_mg            DOUBLE PRECISION,   -- 비타민 C(mg)
    vitamin_d_ug            DOUBLE PRECISION,   -- 비타민 D(μg)

    -- ── 지방산 / 콜레스테롤 ──────────────────────────────
    cholesterol_mg          DOUBLE PRECISION,   -- 콜레스테롤(mg)
    saturated_fat_g         DOUBLE PRECISION,   -- 포화지방산(g)
    trans_fat_g             DOUBLE PRECISION,   -- 트랜스지방산(g)

    -- ── 출처 정보 ────────────────────────────────────────
    source_code             TEXT,   -- 출처코드
    source_name             TEXT,   -- 출처명

    -- ── 브랜드 / 제조사 정보 (영양제 특화) ──────────────
    manufacturer            TEXT,   -- 제조사명
    importer                TEXT,   -- 수입업체명
    distributor             TEXT,   -- 유통업체명
    is_imported             TEXT,   -- 수입여부
    origin_country_code     TEXT,   -- 원산지국코드
    origin_country_name     TEXT,   -- 원산지국명

    -- ── 데이터 생성 메타 ─────────────────────────────────
    data_gen_method_code    TEXT,   -- 데이터생성방법코드
    data_gen_method_name    TEXT,   -- 데이터생성방법명
    data_created_date       TEXT,   -- 데이터생성일자
    data_ref_date           TEXT,   -- 데이터기준일자

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── 인덱스 ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS supplement_master_food_name_idx    ON supplement_master (food_name);
CREATE INDEX IF NOT EXISTS supplement_master_product_reg_idx  ON supplement_master (product_reg_no);
CREATE INDEX IF NOT EXISTS supplement_master_manufacturer_idx ON supplement_master (manufacturer);
CREATE INDEX IF NOT EXISTS supplement_master_major_name_idx   ON supplement_master (food_major_name);

-- ── updated_at 자동 갱신 트리거 ─────────────────────────────
CREATE OR REPLACE FUNCTION update_supplement_master_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplement_master_updated_at ON supplement_master;
CREATE TRIGGER trg_supplement_master_updated_at
    BEFORE UPDATE ON supplement_master
    FOR EACH ROW EXECUTE FUNCTION update_supplement_master_updated_at();

COMMENT ON TABLE supplement_master IS '건강기능식품 영양성분 정보 (식품의약품안전처, 제조사 브랜드 포함)';
COMMENT ON COLUMN supplement_master.food_code      IS '식품의약품안전처 식품코드 (UNIQUE)';
COMMENT ON COLUMN supplement_master.product_reg_no IS '품목제조신고번호';
