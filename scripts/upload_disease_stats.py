"""
질병 통계 CSV → Supabase disease_stats 테이블 업로드
=====================================================
소스 : scripts/질병통계외래.입원.한방.csv  (2,012행)
대상 : disease_stats 테이블
Upsert: kcd_code + medical_type + visit_type 조합 기준
배치 : 500건씩

사전 준비:
  Supabase Dashboard → SQL Editor → supabase/disease_stats.sql 실행

실행:
  python3 scripts/upload_disease_stats.py
"""

import os
import math
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# ── 환경변수 로드 ──────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ .env.local 에서 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 찾을 수 없습니다.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── 설정 ───────────────────────────────────────────────────────
CSV_PATH   = Path(__file__).resolve().parent / "질병통계외래.입원.한방.csv"
TABLE_NAME = "disease_stats"
BATCH_SIZE = 500

# 정수형으로 변환할 컬럼
INT_COLS = ["patient_count", "visit_days", "claim_count",
            "total_cost", "insurer_paid", "self_paid_estimated"]

# 최종 DB 컬럼 순서 (11개)
DB_COLS = [
    "medical_type", "visit_type", "kcd_code", "disease_name",
    "patient_count", "visit_days", "claim_count",
    "total_cost", "insurer_paid", "self_paid_estimated",
    "symptom_keywords",
]


def load_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str, keep_default_na=False)

    # 혹시 남아있을 쉼표 제거 후 정수 변환
    for col in INT_COLS:
        if col in df.columns:
            df[col] = (
                df[col]
                .str.replace(",", "", regex=False)
                .str.strip()
                .apply(lambda x: int(x) if x.lstrip("-").isdigit() else 0)
            )

    # 불필요한 공백 제거
    for col in ["medical_type", "visit_type", "kcd_code", "disease_name", "symptom_keywords"]:
        if col in df.columns:
            df[col] = df[col].str.strip()

    # None 처리: 빈 문자열 → None (DB NULL)
    df = df.where(df != "", other=None)
    return df[DB_COLS]


def preflight_check() -> bool:
    """disease_stats 테이블 존재 여부 + UNIQUE 제약 확인"""
    try:
        supabase.table(TABLE_NAME).select("id").limit(1).execute()
    except Exception as e:
        print(f"❌ 테이블 접근 실패: {e}")
        print("   Supabase Dashboard → SQL Editor에서 supabase/disease_stats.sql 을 먼저 실행하세요.")
        return False

    # UNIQUE 제약 테스트 (임시 upsert 1건)
    test = [{
        "kcd_code": "__test__", "medical_type": "__test__",
        "visit_type": "__test__", "disease_name": "test",
    }]
    try:
        supabase.table(TABLE_NAME).upsert(
            test, on_conflict="kcd_code,medical_type,visit_type"
        ).execute()
        supabase.table(TABLE_NAME).delete().eq("kcd_code", "__test__").execute()
        return True
    except Exception as e:
        if "42P10" in str(e):
            print("❌ UNIQUE 제약(disease_stats_uq)이 없습니다.")
            print("   supabase/disease_stats.sql 을 다시 실행하세요.")
        else:
            print(f"❌ 제약 확인 오류: {e}")
        return False


def upload_batch(records: list[dict], batch_no: int, total_batches: int) -> tuple[int, int]:
    """단일 배치 upsert → (성공 건수, 실패 건수)"""
    try:
        resp = (
            supabase.table(TABLE_NAME)
            .upsert(records, on_conflict="kcd_code,medical_type,visit_type")
            .execute()
        )
        n = len(resp.data) if resp.data else len(records)
        print(f"  배치 {batch_no}/{total_batches}  {n}건 업로드 완료")
        return n, 0
    except Exception as e:
        print(f"  ❌ 배치 {batch_no}/{total_batches} 오류: {e}")
        # 실패 배치를 1건씩 재시도해 어느 행이 문제인지 특정
        success, fail = 0, 0
        for idx, rec in enumerate(records):
            try:
                supabase.table(TABLE_NAME).upsert(
                    [rec], on_conflict="kcd_code,medical_type,visit_type"
                ).execute()
                success += 1
            except Exception as row_err:
                fail += 1
                print(f"     └ 행 오류 [{batch_no * BATCH_SIZE + idx}] "
                      f"kcd={rec.get('kcd_code')} / {rec.get('medical_type')} / "
                      f"{rec.get('visit_type')}: {row_err}")
        print(f"     개별 재시도 결과: 성공 {success}건 / 실패 {fail}건")
        return success, fail


def main():
    if not CSV_PATH.exists():
        print(f"❌ 파일 없음: {CSV_PATH}")
        sys.exit(1)

    # ── 테이블·제약 확인 ──────────────────────────────────────
    print("🔍 테이블 및 UNIQUE 제약 확인 중...")
    if not preflight_check():
        sys.exit(1)
    print("  ✅ 테이블 정상 확인\n")

    # ── CSV 로드 ──────────────────────────────────────────────
    print(f"📄 CSV 로드: {CSV_PATH.name}")
    df = load_csv(CSV_PATH)
    total = len(df)
    print(f"  총 {total:,}행  |  컬럼: {list(df.columns)}\n")

    # ── 배치 업로드 ───────────────────────────────────────────
    records = df.to_dict(orient="records")
    total_batches = math.ceil(total / BATCH_SIZE)
    grand_ok, grand_fail = 0, 0

    print(f"🚀 업로드 시작 — {total_batches}배치 × 최대 {BATCH_SIZE}건")
    print("─" * 50)

    for i in range(0, total, BATCH_SIZE):
        chunk = records[i : i + BATCH_SIZE]
        bn = i // BATCH_SIZE + 1
        ok, fail = upload_batch(chunk, bn, total_batches)
        grand_ok   += ok
        grand_fail += fail

    # ── 최종 요약 ─────────────────────────────────────────────
    print("─" * 50)
    print(f"✅ 업로드 완료")
    print(f"   성공: {grand_ok:,}건  /  실패: {grand_fail:,}건  /  총: {total:,}건")

    if grand_fail > 0:
        print(f"⚠️  {grand_fail}건 실패 — 위 오류 메시지를 확인하세요.")


if __name__ == "__main__":
    main()
