"""
닥터 도슨 신체 컨디션 모니터링 엔진 — 데이터 처리 & Supabase 업로드
====================================================================
처리 대상:
  1. cleaned_checkup_data_2024.csv     → health_benchmarks
  2. 국립암센터_암발생 통계 정보.csv     → cancer_incidence_reference
  3. 국립암센터_24개종 암 상대생존율.csv → cancer_survival_reference

사전 준비:
  Supabase Dashboard → SQL Editor → supabase/health_engine_tables.sql 실행

실행:
  python3 scripts/upload_health_engine.py
"""

import os, math, sys, re
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# ── 환경변수 ──────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ .env.local 에서 Supabase 키를 찾을 수 없습니다.")
    sys.exit(1)

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

SCRIPTS_DIR = Path(__file__).resolve().parent
BATCH = 500

# ── 공통 유틸 ─────────────────────────────────────────────────
AGE_MAP = {
    1: "0~4세",    2: "5~9세",    3: "10~14세",
    4: "15~19세",  5: "20~24세",  6: "25~29세",
    7: "30~34세",  8: "35~39세",  9: "40~44세",
    10: "45~49세", 11: "50~54세", 12: "55~59세",
    13: "60~64세", 14: "65~69세", 15: "70~74세",
    16: "75~79세", 17: "80~84세", 18: "85세이상",
}
# 암통계 파일의 연령군 문자열 → 표준 label
AGE_STR_MAP = {
    "00-04세":"0~4세",   "05-09세":"5~9세",   "10-14세":"10~14세",
    "15-19세":"15~19세", "20-24세":"20~24세", "25-29세":"25~29세",
    "30-34세":"30~34세", "35-39세":"35~39세", "40-44세":"40~44세",
    "45-49세":"45~49세", "50-54세":"50~54세", "55-59세":"55~59세",
    "60-64세":"60~64세", "65-69세":"65~69세", "70-74세":"70~74세",
    "75-79세":"75~79세", "80-84세":"80~84세", "85세이상":"85세이상",
    "연령미상":"연령미상",
}
GENDER_KR = {"남녀전체": "전체", "남자": "남성", "여자": "여성"}

def nan_to_none(v):
    if v is None: return None
    try:
        if math.isnan(float(v)): return None
    except (TypeError, ValueError):
        pass
    return float(v) if isinstance(v, (float, np.floating)) else v

def upsert_batch(table: str, records: list[dict], conflict: str,
                 total: int, done: int) -> tuple[int, int]:
    ok = fail = 0
    for i in range(0, len(records), BATCH):
        chunk = records[i : i + BATCH]
        try:
            resp = sb.table(table).upsert(chunk, on_conflict=conflict).execute()
            n = len(resp.data) if resp.data else len(chunk)
            ok += n; done += n
            print(f"  {done:,}/{total:,}건 완료", end="\r", flush=True)
        except Exception as e:
            fail += len(chunk)
            print(f"\n  ❌ 배치 오류: {e}")
    return ok, fail


# ════════════════════════════════════════════════════════════════
# 1. health_benchmarks — 검진 데이터 성별·연령별 집계
# ════════════════════════════════════════════════════════════════
def build_health_benchmarks() -> list[dict]:
    print("\n📊 health_benchmarks 집계 중 (100만 행)...")
    NUMERIC_COLS = [
        "height_cm", "weight_kg", "waist_cm",
        "systolic_bp", "diastolic_bp", "fasting_glucose",
        "total_cholesterol", "hdl_cholesterol", "ldl_cholesterol",
        "triglyceride", "hemoglobin", "ast", "alt", "gamma_gtp",
    ]
    df = pd.read_csv(
        SCRIPTS_DIR / "cleaned_checkup_data_2024.csv",
        usecols=["gender", "age_group", "age_group_label"] + NUMERIC_COLS,
        dtype={c: "float32" for c in NUMERIC_COLS},
    )

    # BMI 계산
    h = df["height_cm"] / 100.0
    df["bmi"] = (df["weight_kg"] / (h ** 2)).replace([np.inf, -np.inf], np.nan)

    ALL_METRICS = NUMERIC_COLS + ["bmi"]

    # 그룹별 집계
    grp = df.groupby(["gender", "age_group", "age_group_label"])
    agg_avg = grp[ALL_METRICS].mean().round(2)
    agg_std = grp[ALL_METRICS].std().round(2)
    agg_cnt = grp["height_cm"].count().rename("sample_count")

    records = []
    for (gender, age_code, age_label), row_avg in agg_avg.iterrows():
        row_std = agg_std.loc[(gender, age_code, age_label)]
        cnt = int(agg_cnt.loc[(gender, age_code, age_label)])
        rec = {
            "gender": gender,
            "age_group_code": int(age_code),
            "age_group_label": age_label,
            "sample_count": cnt,
            "data_year": 2024,
        }
        # CSV 컬럼명 → DB 필드 기본명 변환 (height_cm → height, weight_kg → weight)
        DB_FIELD = {
            "height_cm": "height", "weight_kg": "weight", "waist_cm": "waist",
            "systolic_bp": "systolic_bp", "diastolic_bp": "diastolic_bp",
            "fasting_glucose": "fasting_glucose",
            "total_cholesterol": "total_cholesterol",
            "hdl_cholesterol": "hdl_cholesterol", "ldl_cholesterol": "ldl_cholesterol",
            "triglyceride": "triglyceride", "hemoglobin": "hemoglobin",
            "ast": "ast", "alt": "alt", "gamma_gtp": "gamma_gtp", "bmi": "bmi",
        }
        for m in ALL_METRICS:
            db_field = DB_FIELD.get(m, m)
            rec[f"{db_field}_avg"] = nan_to_none(row_avg[m])
            rec[f"{db_field}_std"] = nan_to_none(row_std[m])
        records.append(rec)

    print(f"  집계 완료: {len(records)}행 (성별 × 연령대 조합)")
    return records


# ════════════════════════════════════════════════════════════════
# 2. cancer_incidence_reference — 암발생 통계
# ════════════════════════════════════════════════════════════════
def build_cancer_incidence() -> list[dict]:
    print("\n🦠 cancer_incidence_reference 처리 중...")
    df = pd.read_csv(
        '/Users/jaysmac/Downloads/국립암센터_암발생 통계 정보_20260120.csv',
        encoding='utf-8',
    )

    # KCD 코드 추출: "01. C00-C14" → "C00-C14"
    def extract_kcd(s: str) -> str:
        m = re.search(r'C[\w\-]+', str(s))
        return m.group() if m else None

    df['kcd_code']         = df['국제질병분류'].apply(extract_kcd)
    df['gender']           = df['성별'].map(GENDER_KR)
    df['age_group_label']  = df['연령군'].map(AGE_STR_MAP).fillna(df['연령군'])
    df['cancer_type']      = df['암종'].str.strip()
    # '1999-2023' 같은 기간 범위 행 제외 — 개별 연도 행만 사용
    df = df[pd.to_numeric(df['발생연도'], errors='coerce').notna()].copy()
    df['incidence_year']   = df['발생연도'].astype(int)
    df['patient_count']    = pd.to_numeric(df['발생자수'], errors='coerce').fillna(0).astype(int)
    df['incidence_rate']   = pd.to_numeric(df['조발생률'],  errors='coerce')

    # 연령미상 제외
    df = df[df['age_group_label'] != '연령미상']

    records = []
    for _, row in df.iterrows():
        records.append({
            "cancer_type":     row['cancer_type'],
            "kcd_code":        row['kcd_code'],
            "gender":          row['gender'],
            "age_group_label": row['age_group_label'],
            "incidence_year":  row['incidence_year'],
            "patient_count":   int(row['patient_count']),
            "incidence_rate":  nan_to_none(row['incidence_rate']),
        })

    print(f"  처리 완료: {len(records):,}행")
    return records


# ════════════════════════════════════════════════════════════════
# 3. cancer_survival_reference — 암 생존율
# ════════════════════════════════════════════════════════════════
def build_cancer_survival() -> list[dict]:
    print("\n💊 cancer_survival_reference 처리 중...")
    df = pd.read_csv(
        '/Users/jaysmac/Downloads/국립암센터_24개종 암 상대생존율_20260120.csv',
        encoding='utf-8',
    )

    def extract_kcd(s: str) -> str:
        m = re.search(r'C[\w\-]+', str(s))
        return m.group() if m else None

    LATEST_PERIOD = "2019-2023"

    df['kcd_code']               = df['국제질병분류'].apply(extract_kcd)
    df['gender']                 = df['성별'].map(GENDER_KR)
    df['cancer_type']            = df['암종'].str.strip()
    df['period']                 = df['발생기간'].str.strip()
    df['is_latest']              = df['period'] == LATEST_PERIOD
    df['patient_count']          = pd.to_numeric(df['환자수'],         errors='coerce').fillna(0).astype(int)
    df['five_year_survival_rate']= pd.to_numeric(df['5년상대생존율'], errors='coerce')

    records = []
    for _, row in df.iterrows():
        records.append({
            "cancer_type":             row['cancer_type'],
            "kcd_code":                row['kcd_code'],
            "gender":                  row['gender'],
            "period":                  row['period'],
            "is_latest":               bool(row['is_latest']),
            "patient_count":           int(row['patient_count']),
            "five_year_survival_rate": nan_to_none(row['five_year_survival_rate']),
        })

    print(f"  처리 완료: {len(records)}행")
    return records


# ════════════════════════════════════════════════════════════════
# 메인
# ════════════════════════════════════════════════════════════════
def main():
    print("=" * 60)
    print("닥터 도슨 신체 컨디션 모니터링 엔진 — 데이터 업로드")
    print("=" * 60)

    # ── 테이블 존재 확인 ──────────────────────────────────────
    print("\n🔍 테이블 존재 확인...")
    for tbl in ["health_benchmarks", "cancer_incidence_reference", "cancer_survival_reference"]:
        try:
            sb.table(tbl).select("id").limit(1).execute()
            print(f"  ✅ {tbl}")
        except Exception as e:
            print(f"  ❌ {tbl} 접근 실패: {e}")
            print("     supabase/health_engine_tables.sql 을 먼저 실행하세요.")
            sys.exit(1)

    results = {}

    # ── 1. health_benchmarks ─────────────────────────────────
    bench_records = build_health_benchmarks()
    print(f"  Supabase 업로드 중...")
    ok, fail = upsert_batch(
        "health_benchmarks", bench_records,
        "gender,age_group_code",
        len(bench_records), 0,
    )
    print(f"\n  ✅ health_benchmarks: {ok}건 성공 / {fail}건 실패")
    results["health_benchmarks"] = (ok, fail)

    # ── 2. cancer_incidence_reference ────────────────────────
    inci_records = build_cancer_incidence()
    print(f"  Supabase 업로드 중...")
    ok, fail = upsert_batch(
        "cancer_incidence_reference", inci_records,
        "cancer_type,gender,age_group_label,incidence_year",
        len(inci_records), 0,
    )
    print(f"\n  ✅ cancer_incidence_reference: {ok:,}건 성공 / {fail}건 실패")
    results["cancer_incidence_reference"] = (ok, fail)

    # ── 3. cancer_survival_reference ─────────────────────────
    surv_records = build_cancer_survival()
    print(f"  Supabase 업로드 중...")
    ok, fail = upsert_batch(
        "cancer_survival_reference", surv_records,
        "cancer_type,gender,period",
        len(surv_records), 0,
    )
    print(f"\n  ✅ cancer_survival_reference: {ok}건 성공 / {fail}건 실패")
    results["cancer_survival_reference"] = (ok, fail)

    # ── 최종 요약 ─────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("[최종 완료]")
    for tbl, (ok, fail) in results.items():
        status = "✅" if fail == 0 else "⚠️ "
        print(f"  {status} {tbl}: {ok:,}건 업로드")
    total_ok = sum(v[0] for v in results.values())
    print(f"\n  총 {total_ok:,}건 Supabase 적재 완료")


if __name__ == "__main__":
    main()
