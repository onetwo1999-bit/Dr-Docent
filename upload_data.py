import os
import sys
import time
import math
from pathlib import Path

import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

# 스크립트 위치 = 프로젝트 루트 (CSV/책갈피는 여기 기준)
SCRIPT_DIR = Path(__file__).resolve().parent

# .env.local에서 설정 불러오기
load_dotenv(SCRIPT_DIR / ".env.local")
url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase = create_client(url, key)

# 인자로 CSV 지정 시 part2 업로드, 없으면 기본 25만 건용
if len(sys.argv) >= 2:
    CSV_FILE = sys.argv[1]
    base = os.path.splitext(os.path.basename(CSV_FILE))[0]
    STATUS_FILE = f"upload_status_{base}.txt"
    TOTAL_EXPECTED = 0
else:
    CSV_FILE = "processed_food_db_final_250k.csv"
    STATUS_FILE = "upload_status.txt"
    TOTAL_EXPECTED = 250_000

# 경로는 항상 스크립트 폴더 기준 절대 경로로 사용
CSV_PATH = SCRIPT_DIR / CSV_FILE
STATUS_PATH = SCRIPT_DIR / STATUS_FILE

BATCH_SIZE = 500


def _sanitize_record(rec: dict) -> dict:
    """
    Supabase JSON 직렬화 에러 방지를 위해 NaN/Inf 등 out-of-range float 값을 None으로 치환.
    """
    cleaned = {}
    for k, v in rec.items():
        if isinstance(v, float):
            # NaN, Inf, -Inf 모두 JSON에 허용되지 않으므로 None으로 치환
            if not math.isfinite(v):
                cleaned[k] = None
            else:
                cleaned[k] = v
        else:
            cleaned[k] = v
    return cleaned

def run_upload():
    if not CSV_PATH.exists():
        print(f"❌ CSV 파일을 찾을 수 없습니다: {CSV_PATH}")
        return

    # 1. 어디까지 올렸는지 확인 (책갈피는 스크립트 폴더 기준)
    start_row = 0
    if STATUS_PATH.exists():
        with open(STATUS_PATH, "r") as f:
            start_row = int(f.read().strip())

    # 2. 데이터 읽기
    df = pd.read_csv(CSV_PATH)
    total_rows = len(df)

    print(f"🚀 {CSV_FILE} — 총 {total_rows}건 중 {start_row}번부터 업로드 재개!")

    # 3. 루프 돌며 업로드
    for i in range(start_row, total_rows, BATCH_SIZE):
        raw_batch = df.iloc[i : i + BATCH_SIZE].to_dict(orient="records")
        # NaN/Inf 등 JSON 비호환 값 정리
        batch = [_sanitize_record(r) for r in raw_batch]
        
        try:
            # 수파베이스로 발송
            supabase.table("food_knowledge").insert(batch).execute()
            
            # 성공하면 현재 위치를 메모장에 기록 (책갈피 끼우기)
            current_pos = i + len(batch)
            with open(STATUS_PATH, "w") as f:
                f.write(str(current_pos))

            # 진행 로그: [성공] XXX / 250,000 완료 (진행률: XX%)
            progress_base = TOTAL_EXPECTED if TOTAL_EXPECTED > 0 else total_rows
            pct = (current_pos / progress_base) * 100 if progress_base else 0
            print(f"[성공] {current_pos} / {progress_base:,} 완료 (진행률: {pct:.1f}%)")

            # 서버 부담 완화를 위한 짧은 휴식
            time.sleep(0.5)
            
        except Exception as e:
            print(f"🚨 {i}번 지점에서 멈춤: {e}")
            print("❌ 인터넷 연결 등을 확인하고 다시 실행하세요. 멈춘 곳부터 이어집니다.")
            break

if __name__ == "__main__":
    run_upload()
