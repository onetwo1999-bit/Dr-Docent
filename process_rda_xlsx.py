"""
raw_rda_db.xlsx → processed_rda_final.csv (열 좌표 기반 100% 정밀 추출)

1. 기본 설정: 시트 '국가표준성분 Database 10.3', 모든 영양소 수치는 식품 100g당 함량.
   데이터 구조 및 로그에 단위(100g당) 명시.
2. 데이터 시작 행: 실제 수치가 시작되는 행(보통 4~5행, 0-based 4)부터 끝까지 전 행 처리.
3. 정밀 열(Column) 매핑: 대문자 좌표(D,F,G,...) → 영문 컬럼명 정확 매핑.
4. 결측치: 0.0, -, TR, (0), . 등 → 숫자 0. unit 컬럼 생성, 값 "100g".
5. 저장: processed_rda_final.csv. 성공 시 첫 5행 + 총 행 개수 출력.

실행: python process_rda_xlsx.py
"""

import os
import re
from pathlib import Path

import pandas as pd

INPUT_XLSX = "raw_rda_db.xlsx"
OUTPUT_CSV = "processed_rda_final.csv"
SHEET_NAME = "국가표준식품성분 Database 10.3"
PER_100G_LABEL = "100g"
# 실제 데이터 수치가 시작되는 행 (0-based). 보통 4행 또는 5행
DATA_START_ROW = 4

# Excel 열(Column) 대문자 → 영문 컬럼명 (순서 유지)
# 구분별: 기본(D), 에너지/수분(F,G), 5대영양소(H,I,K,L,S), 미네랄(V~AC), 비타민(AH,AR,AT...), 아미노산(BO~CI), 지방산/기타(CJ,CK,CM,DD,DZ,EA,EB)
COLUMN_MAPPING = [
    ("D", "food_name"),
    ("F", "calories"),
    ("G", "water"),
    ("H", "protein"),
    ("I", "fat"),
    ("K", "carbs"),
    ("L", "sugar"),
    ("S", "fiber"),
    ("V", "calcium"),
    ("W", "iron"),
    ("X", "magnesium"),
    ("Y", "phosphorus"),
    ("Z", "potassium"),
    ("AA", "sodium"),
    ("AB", "zinc"),
    ("AC", "copper"),
    ("AH", "vit_a"),
    ("AR", "vit_b6"),
    ("AT", "biotin"),
    ("AU", "folate"),
    ("AX", "vit_b12"),
    ("AY", "vit_c"),
    ("AZ", "vit_d"),
    ("BC", "vit_e"),
    ("BL", "vit_k"),
    ("BO", "total_amino"),
    ("BP", "essential_amino"),
    ("BQ", "isoleucine"),
    ("BR", "leucine"),
    ("BS", "lysine"),
    ("BT", "methionine"),
    ("BU", "phenylalanine"),
    ("BV", "threonine"),
    ("BW", "tryptophan"),
    ("BX", "valine"),
    ("BY", "histidine"),
    ("BZ", "arginine"),
    ("CA", "tyrosine"),
    ("CB", "cysteine"),
    ("CC", "alanine"),
    ("CD", "aspartic_acid"),
    ("CE", "glutamic_acid"),
    ("CF", "glycine"),
    ("CG", "proline"),
    ("CH", "serine"),
    ("CI", "taurine"),
    ("CJ", "cholesterol"),
    ("CK", "total_fatty_acid"),
    ("CM", "saturated_fat"),
    ("DD", "unsaturated_fat"),
    ("DZ", "omega3"),
    ("EA", "omega6"),
    ("EB", "trans_fat"),
]

NON_NUMERIC_VALUES = {
    "-", ".", "TR", "tr", "Tr", "(0)", "N.D.", "n.d.", "ND", "nd",
    "0.0", "—", "－", "·", "미량", "trace", "",
}


def col_letter_to_index(letter: str) -> int:
    """Excel 열 문자 → 0-based 인덱스. A=0, B=1, ..., Z=25, AA=26, AB=27, ..."""
    s = str(letter).upper().strip()
    n = 0
    for c in s:
        n = n * 26 + (ord(c) - ord("A") + 1)
    return n - 1


def to_numeric_value(val):
    """0.0, -, TR, (0), . 등 → 0, 그 외 숫자만 추출."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return 0
    if isinstance(val, (int, float)):
        return 0 if pd.isna(val) else float(val)
    s = str(val).strip()
    if s in NON_NUMERIC_VALUES:
        return 0
    s_clean = s.replace("(", "").replace(")", "").replace(",", "").strip()
    if s_clean in ("", ".", "-", "TR", "0", "0.0"):
        return 0
    m = re.search(r"-?\d+\.?\d*", s_clean)
    if m:
        try:
            return float(m.group())
        except ValueError:
            return 0
    return 0


def main():
    folder = Path(__file__).resolve().parent
    cwd = Path.cwd()
    xlsx_path = folder / INPUT_XLSX
    if not xlsx_path.exists():
        xlsx_path = cwd / INPUT_XLSX
    if not xlsx_path.exists():
        print(f"❌ {INPUT_XLSX} 파일을 찾을 수 없습니다.")
        return

    xlsx_abs = os.path.abspath(str(xlsx_path.resolve()))
    csv_path = folder / OUTPUT_CSV

    try:
        xl = pd.ExcelFile(xlsx_abs, engine="openpyxl")
    except Exception as e:
        print(f"❌ 엑셀 파일을 열 수 없습니다: {e}")
        return

    if SHEET_NAME not in xl.sheet_names:
        print(f"❌ 시트 '{SHEET_NAME}' 이(가) 없습니다.")
        print(f"   실제 시트 목록: {xl.sheet_names}")
        return

    # 시트 전체를 헤더 없이 읽고, 데이터 시작 행(DATA_START_ROW)부터 사용
    raw = pd.read_excel(xl, sheet_name=SHEET_NAME, header=None)
    ncols_raw = raw.shape[1]

    # 1) 좌표 재확인: 대문자 좌표 → iloc 인덱스(숫자) 터미널 출력
    col_list = [(letter, col_letter_to_index(letter), name) for letter, name in COLUMN_MAPPING]
    print("📐 좌표 재확인 (엑셀 열 → iloc 인덱스):")
    line = ", ".join(f"{letter}={idx}" for letter, idx, _ in col_list)
    print(f"   {line}\n")

    # 2) 샘플 추출: 엑셀 5행(Index 4) 데이터 → 영양소명 vs 실제 숫자 표
    SAMPLE_ROW = 4  # 엑셀 5행 = 0-based index 4
    sample_data = []
    for letter, idx, name in col_list:
        if idx >= ncols_raw:
            val = "(열 없음)"
        else:
            raw_val = raw.iloc[SAMPLE_ROW, idx]
            if name == "food_name":
                val = str(raw_val).strip() if pd.notna(raw_val) else ""
            else:
                num = to_numeric_value(raw_val)
                val = f"{raw_val} → {num}"
        sample_data.append({"엑셀열": letter, "영문컬럼": name, "5행(Index4) 값": val})
    sample_df = pd.DataFrame(sample_data)
    print("📋 샘플 추출 (엑셀 5행(Index 4) — 영양소별 실제 값):")
    print(sample_df.to_string(index=False))
    print()

    # 3) 강제 쓰기: 동일 로직으로 전체 데이터 추출 후 CSV 덮어쓰기
    df_raw = raw.iloc[DATA_START_ROW:].copy()
    df_raw.reset_index(drop=True, inplace=True)
    ncols = df_raw.shape[1]

    col_indices = [(idx, name) for _, idx, name in col_list]
    out = pd.DataFrame()
    d_idx = col_indices[0][0]
    out["food_name"] = df_raw.iloc[:, d_idx].astype(str).replace("nan", "").str.strip() if d_idx < ncols else ""
    out["unit"] = PER_100G_LABEL

    for idx, name in col_indices:
        if name == "food_name":
            continue
        if idx >= ncols:
            out[name] = 0
            continue
        out[name] = df_raw.iloc[:, idx].apply(to_numeric_value)

    col_order = ["food_name", "unit"] + [name for _, name in COLUMN_MAPPING if name != "food_name"]
    out = out[[c for c in col_order if c in out.columns]]
    out.to_csv(csv_path, index=False, encoding="utf-8-sig")

    total = len(out)
    print(f"✅ {OUTPUT_CSV} 덮어쓰기 완료 (총 {total:,}행)")

    # 4) 단위 확인: unit 컬럼 전체 "100g" 여부 체크
    unit_ok = out["unit"].eq(PER_100G_LABEL).all()
    if unit_ok:
        print(f"   unit 컬럼 확인: 모든 행에 '100g' 적용됨 ({total:,}행)")
    else:
        bad = out.loc[out["unit"] != PER_100G_LABEL]
        print(f"   ⚠️ unit 컬럼 오류: {len(bad)}행이 '100g'이 아님. 행 인덱스: {list(bad.index[:20])}")

    print("\n📌 저장된 CSV 첫 5행:")
    print(out.head().to_string())


if __name__ == "__main__":
    main()
