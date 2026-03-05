"""
upload_nutrition.py
────────────────────────────────────────────────────────────────────
식품의약품안전처 영양 데이터 2종 → Supabase 업로드

  1. 통합식품영양성분정보(음식)_20251229.csv  → food_knowledge  (upsert by food_code)
  2. 건강기능식품영양성분정보_20251230.csv     → supplement_master (upsert by food_code)

실행: python3 scripts/upload_nutrition.py
────────────────────────────────────────────────────────────────────
"""

import os, re, sys
import pandas as pd
from supabase import create_client

# ── 환경 변수 ──────────────────────────────────────────────────────
SUPABASE_URL = "https://fddoizheudxxqescjpbq.supabase.co"
SUPABASE_KEY = 

FOOD_CSV  = "/Users/jaysmac/Downloads/식품의약품안전처_통합식품영양성분정보(음식)_20251229.csv"
SUPP_CSV  = "/Users/jaysmac/Downloads/식품의약품안전처_건강기능식품영양성분정보_20251230.csv"

BATCH = 500

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── 공통 유틸 ──────────────────────────────────────────────────────
def to_float(v):
    """쉼표·단위 제거 후 float 변환. 변환 불가 → None."""
    if pd.isna(v):
        return None
    s = re.sub(r"[^\d.\-]", "", str(v))
    try:
        return float(s) if s not in ("", "-") else None
    except ValueError:
        return None

def to_text(v):
    if pd.isna(v):
        return None
    s = str(v).strip()
    return s if s else None

def upload_batches(table: str, records: list, conflict_col: str):
    """records를 BATCH 단위로 upsert. 결과 요약 반환."""
    ok = fail = 0
    total = len(records)
    for i in range(0, total, BATCH):
        chunk = records[i:i + BATCH]
        try:
            sb.table(table).upsert(chunk, on_conflict=conflict_col).execute()
            ok += len(chunk)
        except Exception as e:
            fail += len(chunk)
            print(f"\n  ❌ 배치 오류 [{i}~{i+len(chunk)}]: {e}")
        done = min(i + BATCH, total)
        print(f"  {done:,}/{total:,}건 완료", end="\r")
    print()
    return ok, fail


# ── 1. 통합식품영양성분정보(음식) → food_knowledge ─────────────────
FOOD_COL_MAP = {
    "식품코드":           "food_code",
    "식품명":             "food_name",
    "데이터구분코드":     "data_type_code",
    "데이터구분명":       "data_type_name",
    "식품기원코드":       "food_origin_code",
    "식품기원명":         "food_origin_name",
    "식품대분류코드":     "food_major_code",
    "식품대분류명":       "food_major_name",
    "대표식품코드":       "rep_food_code",
    "대표식품명":         "rep_food_name",
    "식품중분류코드":     "food_mid_code",
    "식품중분류명":       "food_mid_name",
    "식품소분류코드":     "food_sub_code",
    "식품소분류명":       "food_sub_name",
    "식품세분류코드":     "food_detail_code",
    "식품세분류명":       "food_detail_name",
    "영양성분함량기준량": "serving_unit",
    "에너지(kcal)":       "calories",
    "수분(g)":            "moisture_g",
    "단백질(g)":          "protein",
    "지방(g)":            "fat",
    "회분(g)":            "ash_g",
    "탄수화물(g)":        "carbs",
    "당류(g)":            "sugar",
    "식이섬유(g)":        "dietary_fiber_g",
    "칼슘(mg)":           "calcium_mg",
    "철(mg)":             "iron_mg",
    "인(mg)":             "phosphorus_mg",
    "칼륨(mg)":           "potassium_mg",
    "나트륨(mg)":         "sodium",
    "비타민 A(μg RAE)":   "vitamin_a_ug",
    "레티놀(μg)":         "retinol_ug",
    "베타카로틴(μg)":     "beta_carotene_ug",
    "티아민(mg)":         "thiamine_mg",
    "리보플라빈(mg)":     "riboflavin_mg",
    "니아신(mg)":         "niacin_mg",
    "비타민 C(mg)":       "vitamin_c_mg",
    "비타민 D(μg)":       "vitamin_d_ug",
    "콜레스테롤(mg)":     "cholesterol",
    "포화지방산(g)":      "saturated_fatty_acids_g",
    "트랜스지방산(g)":    "trans_fatty_acids_g",
    "출처코드":           "source_code",
    "출처명":             "source_name",
    "1인(회)분량 참고량": "serving_ref_size",
    "식품중량":           "food_weight",
    "업체명":             "manufacturer",
    "데이터생성방법코드": "data_gen_method_code",
    "데이터생성방법명":   "data_gen_method_name",
    "데이터생성일자":     "data_created_date",
    "데이터기준일자":     "data_ref_date",
}

FOOD_FLOAT_COLS = {
    "calories", "moisture_g", "protein", "fat", "ash_g",
    "carbs", "sugar", "dietary_fiber_g",
    "calcium_mg", "iron_mg", "phosphorus_mg", "potassium_mg", "sodium",
    "vitamin_a_ug", "retinol_ug", "beta_carotene_ug",
    "thiamine_mg", "riboflavin_mg", "niacin_mg",
    "vitamin_c_mg", "vitamin_d_ug",
    "cholesterol", "saturated_fatty_acids_g", "trans_fatty_acids_g",
}


def build_food_records(df: pd.DataFrame) -> list:
    records = []
    for _, row in df.iterrows():
        rec = {}
        for kr, en in FOOD_COL_MAP.items():
            if kr not in df.columns:
                continue
            val = row[kr]
            if en in FOOD_FLOAT_COLS:
                rec[en] = to_float(val)
            else:
                rec[en] = to_text(val)
        if rec.get("food_code") and rec.get("food_name"):
            records.append(rec)
    return records


def upload_food():
    print("\n🥗 통합식품영양성분정보(음식) → food_knowledge")
    df = pd.read_csv(FOOD_CSV, encoding="utf-8", low_memory=False)
    print(f"  CSV 로드: {len(df):,}행")

    # food_code 중복 제거 (최신 기준일자 우선)
    if "데이터기준일자" in df.columns:
        df = df.sort_values("데이터기준일자").drop_duplicates(subset="식품코드", keep="last")
    else:
        df = df.drop_duplicates(subset="식품코드", keep="last")
    print(f"  중복 제거 후: {len(df):,}행")

    records = build_food_records(df)
    print(f"  레코드 변환 완료: {len(records):,}건")
    print(f"  Supabase 업로드 중 (배치 {BATCH}건)...")
    ok, fail = upload_batches("food_knowledge", records, "food_code")
    print(f"  ✅ food_knowledge: {ok:,}건 성공 / {fail:,}건 실패")
    return ok, fail


# ── 2. 건강기능식품영양성분정보 → supplement_master ────────────────
SUPP_COL_MAP = {
    "식품코드":           "food_code",
    "식품명":             "food_name",
    "데이터구분코드":     "data_type_code",
    "데이터구분명":       "data_type_name",
    "식품기원코드":       "food_origin_code",
    "식품기원명":         "food_origin_name",
    "식품대분류코드":     "food_major_code",
    "식품대분류명":       "food_major_name",
    "대표식품코드":       "rep_food_code",
    "대표식품명":         "rep_food_name",
    "식품중분류코드":     "food_mid_code",
    "식품중분류명":       "food_mid_name",
    "식품소분류코드":     "food_sub_code",
    "식품소분류명":       "food_sub_name",
    "식품세분류코드":     "food_detail_code",
    "식품세분류명":       "food_detail_name",
    "유형명":             "type_name",
    "영양성분제공단위량": "serving_unit",
    "1회분량":            "serving_amount",
    "1회분량중량/부피":   "serving_weight",
    "1일섭취횟수":        "daily_intake_count",
    "섭취대상":           "intake_target",
    "식품중량/부피":      "food_weight",
    "에너지(kcal)":       "calories",
    "수분(g)":            "moisture_g",
    "단백질(g)":          "protein_g",
    "지방(g)":            "fat_g",
    "회분(g)":            "ash_g",
    "탄수화물(g)":        "carbs_g",
    "당류(g)":            "sugar_g",
    "식이섬유(g)":        "dietary_fiber_g",
    "칼슘(mg)":           "calcium_mg",
    "철(mg)":             "iron_mg",
    "인(mg)":             "phosphorus_mg",
    "칼륨(mg)":           "potassium_mg",
    "나트륨(mg)":         "sodium_mg",
    "비타민 A(μg RAE)":   "vitamin_a_ug",
    "레티놀(μg)":         "retinol_ug",
    "베타카로틴(μg)":     "beta_carotene_ug",
    "티아민(mg)":         "thiamine_mg",
    "리보플라빈(mg)":     "riboflavin_mg",
    "니아신(mg)":         "niacin_mg",
    "비타민 C(mg)":       "vitamin_c_mg",
    "비타민 D(μg)":       "vitamin_d_ug",
    "콜레스테롤(mg)":     "cholesterol_mg",
    "포화지방산(g)":      "saturated_fat_g",
    "트랜스지방산(g)":    "trans_fat_g",
    "출처코드":           "source_code",
    "출처명":             "source_name",
    "품목제조신고번호":   "product_reg_no",
    "제조사명":           "manufacturer",
    "수입업체명":         "importer",
    "유통업체명":         "distributor",
    "수입여부":           "is_imported",
    "원산지국코드":       "origin_country_code",
    "원산지국명":         "origin_country_name",
    "데이터생성방법코드": "data_gen_method_code",
    "데이터생성방법명":   "data_gen_method_name",
    "데이터생성일자":     "data_created_date",
    "데이터기준일자":     "data_ref_date",
}

SUPP_FLOAT_COLS = {
    "calories", "moisture_g", "protein_g", "fat_g", "ash_g",
    "carbs_g", "sugar_g", "dietary_fiber_g",
    "calcium_mg", "iron_mg", "phosphorus_mg", "potassium_mg", "sodium_mg",
    "vitamin_a_ug", "retinol_ug", "beta_carotene_ug",
    "thiamine_mg", "riboflavin_mg", "niacin_mg",
    "vitamin_c_mg", "vitamin_d_ug",
    "cholesterol_mg", "saturated_fat_g", "trans_fat_g",
}


def build_supp_records(df: pd.DataFrame) -> list:
    records = []
    for _, row in df.iterrows():
        rec = {}
        for kr, en in SUPP_COL_MAP.items():
            if kr not in df.columns:
                continue
            val = row[kr]
            if en in SUPP_FLOAT_COLS:
                rec[en] = to_float(val)
            else:
                rec[en] = to_text(val)
        if rec.get("food_code") and rec.get("food_name"):
            records.append(rec)
    return records


def upload_supplement():
    print("\n💊 건강기능식품영양성분정보 → supplement_master")
    try:
        df = pd.read_csv(SUPP_CSV, encoding="utf-8", low_memory=False)
    except UnicodeDecodeError:
        df = pd.read_csv(SUPP_CSV, encoding="cp949", low_memory=False)
    print(f"  CSV 로드: {len(df):,}행")

    df = df.drop_duplicates(subset="식품코드", keep="last")
    print(f"  중복 제거 후: {len(df):,}행")

    records = build_supp_records(df)
    print(f"  레코드 변환 완료: {len(records):,}건")
    print(f"  Supabase 업로드 중 (배치 {BATCH}건)...")
    ok, fail = upload_batches("supplement_master", records, "food_code")
    print(f"  ✅ supplement_master: {ok:,}건 성공 / {fail:,}건 실패")
    return ok, fail


# ── 사전 점검 ─────────────────────────────────────────────────────
def preflight_check():
    """필수 테이블 및 컬럼 존재 여부 확인."""
    errors = []

    # food_knowledge food_code 컬럼 확인
    try:
        sb.table("food_knowledge").select("food_code").limit(1).execute()
    except Exception as e:
        if "42703" in str(e) or "PGRST204" in str(e):
            errors.append(
                "food_knowledge 테이블에 food_code 컬럼이 없습니다.\n"
                "→ supabase/food_mfds_columns.sql 을 Supabase SQL Editor에서 먼저 실행해 주세요."
            )

    # supplement_master 테이블 확인
    try:
        sb.table("supplement_master").select("food_code").limit(1).execute()
    except Exception as e:
        if "PGRST205" in str(e) or "42P01" in str(e):
            errors.append(
                "supplement_master 테이블이 없습니다.\n"
                "→ supabase/supplement_master.sql 을 Supabase SQL Editor에서 먼저 실행해 주세요."
            )

    return errors


# ── main ──────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("닥터 도슨 영양 데이터 업로드")
    print("  ① 통합식품영양성분정보(음식)  → food_knowledge")
    print("  ② 건강기능식품영양성분정보    → supplement_master")
    print("=" * 60)

    print("\n🔍 사전 점검 중...")
    errs = preflight_check()
    if errs:
        print("\n❌ 업로드 중단 — 아래 조치 후 재실행해 주세요:\n")
        for e in errs:
            print(f"  • {e}\n")
        sys.exit(1)
    print("  ✅ 모든 테이블 및 컬럼 확인 완료")

    food_ok, food_fail   = upload_food()
    # supplement_master는 이미 업로드 완료 시 건너뜀
    try:
        check = sb.table("supplement_master").select("food_code", count="exact").limit(1).execute()
        if check.count and check.count > 0:
            print(f"\n💊 supplement_master: 이미 {check.count:,}건 적재됨 — 건너뜀")
            supp_ok, supp_fail = check.count, 0
        else:
            supp_ok, supp_fail = upload_supplement()
    except Exception:
        supp_ok, supp_fail = upload_supplement()

    print("\n" + "=" * 60)
    print("[최종 완료]")
    print(f"  ✅ food_knowledge : {food_ok:,}건 업로드")
    print(f"  ✅ supplement_master: {supp_ok:,}건 업로드")
    total = food_ok + supp_ok
    total_fail = food_fail + supp_fail
    print(f"\n  총 {total:,}건 Supabase 적재 완료"
          + (f" / {total_fail:,}건 실패" if total_fail else ""))
    print("=" * 60)


if __name__ == "__main__":
    main()
