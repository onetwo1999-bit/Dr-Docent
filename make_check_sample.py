"""
raw_food_db.xlsx 상위 100행만 추출해서 check_sample.xlsx로 저장하는 스크립트.

실행:
    python make_check_sample.py
결과:
    - 원본: raw_food_db.xlsx
    - 샘플: check_sample.xlsx (상위 100행)
"""

from pathlib import Path

import pandas as pd


INPUT_XLSX = "raw_food_db.xlsx"
OUTPUT_XLSX = "check_sample.xlsx"
NROWS = 100


def main():
    base_dir = Path(__file__).resolve().parent
    src = base_dir / INPUT_XLSX
    dst = base_dir / OUTPUT_XLSX

    if not src.exists():
        print(f"❌ 현재 폴더에 {INPUT_XLSX} 파일이 없습니다.")
        return

    print(f"📥 {INPUT_XLSX}에서 상위 {NROWS}행만 읽는 중...")
    # nrows 옵션으로 상위 N행만 메모리에 로드
    df = pd.read_excel(src, nrows=NROWS)

    print(f"💾 {OUTPUT_XLSX}로 저장 중...")
    df.to_excel(dst, index=False)

    print(f"✅ {OUTPUT_XLSX} 생성 완료 (총 {len(df)}행)")


if __name__ == "__main__":
    main()

