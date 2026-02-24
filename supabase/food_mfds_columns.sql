-- ============================================================
-- food_knowledge 테이블 확장
-- 식품의약품안전처_통합식품영양성분정보(음식) 데이터 수용용
-- 실행: Supabase SQL Editor에서 이 파일 내용 전체 실행
-- ============================================================

-- 1. 식품코드 (식약처 고유 ID, UNIQUE 키)
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS food_knowledge_food_code_uniq
    ON food_knowledge (food_code)
    WHERE food_code IS NOT NULL;

-- 2. 분류 체계 코드/명
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS data_type_code   TEXT;  -- 데이터구분코드
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS data_type_name   TEXT;  -- 데이터구분명
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_origin_code TEXT;  -- 식품기원코드
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_origin_name TEXT;  -- 식품기원명
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_major_code  TEXT;  -- 식품대분류코드
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_major_name  TEXT;  -- 식품대분류명
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS rep_food_code    TEXT;  -- 대표식품코드
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS rep_food_name    TEXT;  -- 대표식품명
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_mid_code    TEXT;  -- 식품중분류코드
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_mid_name    TEXT;  -- 식품중분류명
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_sub_code    TEXT;  -- 식품소분류코드
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_sub_name    TEXT;  -- 식품소분류명
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_detail_code TEXT;  -- 식품세분류코드
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_detail_name TEXT;  -- 식품세분류명

-- 3. 추가 영양소 (식약처 파일에만 있는 항목)
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS ash_g           DOUBLE PRECISION;  -- 회분(g)
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS retinol_ug      DOUBLE PRECISION;  -- 레티놀(μg)
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS beta_carotene_ug DOUBLE PRECISION; -- 베타카로틴(μg)
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS thiamine_mg     DOUBLE PRECISION;  -- 티아민(mg)
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS riboflavin_mg   DOUBLE PRECISION;  -- 리보플라빈(mg)
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS niacin_mg       DOUBLE PRECISION;  -- 니아신(mg)

-- 4. 출처 및 제공 정보
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS source_code       TEXT;  -- 출처코드
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS source_name       TEXT;  -- 출처명
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS serving_ref_size  TEXT;  -- 1인(회)분량 참고량
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS food_weight       TEXT;  -- 식품중량
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS manufacturer      TEXT;  -- 업체명

-- 5. 데이터 생성 메타
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS data_gen_method_code TEXT;  -- 데이터생성방법코드
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS data_gen_method_name TEXT;  -- 데이터생성방법명
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS data_created_date    TEXT;  -- 데이터생성일자
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS data_ref_date        TEXT;  -- 데이터기준일자

COMMENT ON COLUMN food_knowledge.food_code IS '식품의약품안전처 식품코드 (UNIQUE, NULL 허용)';
COMMENT ON TABLE  food_knowledge IS '음식 영양성분 통합 테이블 (RDA + 식약처 통합)';
