"""
processed_rda_final.csv → Supabase food_knowledge 테이블 업로드

- CSV 헤더와 수파베이스 컬럼명 100% 일치하여 insert
- 500개씩 배치, upload_rda_status.txt로 이어올리기(재시작 시 멈춘 지점부터)
- 실시간 로그: "O건 완료/총 3,330건"

실행: python upload_rda_final.py
"""

import os
import math
import time
from pathlib import Path

import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
CSV_FILE = "processed_rda_final.csv"
STATUS_FILE = "upload_rda_status.txt"
BATCH_SIZE = 500
TOTAL_EXPECTED = 3330

load_dotenv(SCRIPT_DIR / ".env.local")
url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase = create_client(url, key)

CSV_PATH = SCRIPT_DIR / CSV_FILE
STATUS_PATH = SCRIPT_DIR / STATUS_FILE


def _sanitize_record(rec: dict) -> dict:
    """NaN/Inf 등 JSON 비호환 값 → None."""
    cleaned = {}
    for k, v in rec.items():
        if isinstance(v, float):
            cleaned[k] = None if not math.isfinite(v) else v
        else:
            cleaned[k] = v
    return cleaned


def run_upload():
    if not CSV_PATH.exists():
        print(f"❌ CSV 파일을 찾을 수 없습니다: {CSV_PATH}")
        return

    start_row = 0
    if STATUS_PATH.exists():
        with open(STATUS_PATH, "r") as f:
            start_row = int(f.read().strip())

    df = pd.read_csv(CSV_PATH)
    total_rows = len(df)

    print(f"🚀 {CSV_FILE} → food_knowledge (총 {total_rows:,}건, {start_row}번부터 재개)")

    for i in range(start_row, total_rows, BATCH_SIZE):
        raw_batch = df.iloc[i : i + BATCH_SIZE].to_dict(orient="records")
        batch = [_sanitize_record(r) for r in raw_batch]

        try:
            supabase.table("food_knowledge").insert(batch).execute()

            current_pos = i + len(batch)
            with open(STATUS_PATH, "w") as f:
                f.write(str(current_pos))

            print(f"{current_pos}건 완료/총 {total_rows:,}건")
            time.sleep(0.5)

        except Exception as e:
            print(f"🚨 {i}번 지점에서 멈춤: {e}")
            print("다시 실행 시 멈춘 곳부터 이어집니다.")
            break
    else:
        # 루프가 break 없이 끝나면 전체 완료
        print(f"✅ 업로드 완료: {total_rows:,}건")


if __name__ == "__main__":
    run_upload()
