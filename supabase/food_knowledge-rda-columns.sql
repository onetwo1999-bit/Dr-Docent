-- food_knowledge 테이블에 RDA(농진청) 영양소 컬럼 추가
-- process_rda_xlsx.py 추출 키워드 기준 영문 컬럼명 매핑
-- 실행: Supabase SQL Editor에서 이 파일 내용 실행
--
-- 한글 키워드 → 영문 컬럼명 매핑:
--   식품명/에너지/단위 → food_name, calories, serving_unit (기존 2개 + serving_unit)
--   수분 → moisture_g | 단백질/지방/탄수화물/당류/나트륨 → 기존 protein, fat, carbs, sugar, sodium
--   총 식이섬유 → dietary_fiber_g | 칼슘/철/마그네슘/인/칼륨/아연 → calcium_mg, iron_mg, magnesium_mg, phosphorus_mg, potassium_mg, zinc_mg
--   비타민 A~K → vitamin_a_ug, vitamin_b_mg, vitamin_c_mg, vitamin_d_ug, vitamin_e_mg, vitamin_k_ug
--   총 아미노산/이소류신/류신 → total_amino_acids_g, isoleucine_g, leucine_g
--   총 지방산/포화/불포화/오메가3·6/트랜스 → total_fatty_acids_g, saturated_fatty_acids_g, unsaturated_fatty_acids_g, omega3_fatty_acids_g, omega6_fatty_acids_g, trans_fatty_acids_g
--
-- PostgreSQL 9.5+ 에서 ADD COLUMN IF NOT EXISTS 지원. 구버전이면 IF NOT EXISTS 제거 후 중복 컬럼은 수동 스킵.

-- 기본 정보 (단위 = 1회 제공량 등)
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS serving_unit TEXT;

-- 수분
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS moisture_g DOUBLE PRECISION;

-- 총 식이섬유 (탄수화물/당류/단백질/지방/나트륨은 기존 컬럼 사용)
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS dietary_fiber_g DOUBLE PRECISION;

-- 무기질
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS calcium_mg DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS iron_mg DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS magnesium_mg DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS phosphorus_mg DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS potassium_mg DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS zinc_mg DOUBLE PRECISION;

-- 비타민
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS vitamin_a_ug DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS vitamin_b_mg DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS vitamin_c_mg DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS vitamin_d_ug DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS vitamin_e_mg DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS vitamin_k_ug DOUBLE PRECISION;

-- 아미노산
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS total_amino_acids_g DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS isoleucine_g DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS leucine_g DOUBLE PRECISION;

-- 지방산 상세 (기본 지방은 기존 fat 컬럼)
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS total_fatty_acids_g DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS saturated_fatty_acids_g DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS unsaturated_fatty_acids_g DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS omega3_fatty_acids_g DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS omega6_fatty_acids_g DOUBLE PRECISION;
ALTER TABLE food_knowledge ADD COLUMN IF NOT EXISTS trans_fatty_acids_g DOUBLE PRECISION;

-- 완료 메시지 (실행 시 참고용)
-- SELECT 'food_knowledge RDA columns added.' AS result;
