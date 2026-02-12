"""
새 가공식품 DB(raw_food_db.xlsx 또는 .numbers) → Supabase 업로드용 CSV 변환

실행: python process_new_data.py
결과: processed_food_db_v2.csv (9개 컬럼만)
"""

import json
from pathlib import Path

import pandas as pd

# 출력 파일명
OUTPUT_CSV = "processed_food_db_v2.csv"
NUTRIENT_COLS = ["calories", "protein", "fat", "carbs", "sugar", "sodium"]
FINAL_COLS = [
    "food_name", "calories", "protein", "fat", "carbs", "sugar", "sodium",
    "clinical_insight", "synthetic_qa",
]

# 원본 한글 컬럼 → 수파베이스 영문 컬럼 (여러 표기 허용)
COLUMN_MAPPING = [
    ("식품명", "food_name"),
    ("에너지(kcal)", "calories"),
    ("에너지", "calories"),
    ("단백질(g)", "protein"),
    ("단백질", "protein"),
    ("지방(g)", "fat"),
    ("지방", "fat"),
    ("탄수화물(g)", "carbs"),
    ("탄수화물", "carbs"),
    ("당류(g)", "sugar"),
    ("당류", "sugar"),
    ("나트륨(mg)", "sodium"),
    ("나트륨", "sodium"),
]

# 1인분 환산용으로 찾을 컬럼 키워드 (순서대로 우선)
WEIGHT_KEYWORDS = ["1회제공량", "1회 제공량", "총내용량", "중량", "내용량", "1회분량"]


def find_raw_file():
    folder = Path(__file__).resolve().parent
    xlsx = folder / "raw_food_db.xlsx"
    numbers = folder / "raw_food_db.numbers"
    if xlsx.exists():
        return xlsx, "xlsx"
    if numbers.exists():
        return numbers, "numbers"
    return None, None


def load_xlsx(path: Path) -> pd.DataFrame:
    return pd.read_excel(path)


def load_numbers(path: Path) -> pd.DataFrame:
    from numbers_parser import Document
    doc = Document(str(path))
    table = doc.sheets[0].tables[0]
    rows = [[cell.value for cell in row] for row in table.rows()]
    return pd.DataFrame(rows[1:], columns=rows[0])


def load_dataframe(path: Path, fmt: str) -> pd.DataFrame:
    if fmt == "xlsx":
        return load_xlsx(path)
    return load_numbers(path)


def apply_column_mapping(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # 한글 → 영문 이름 매핑 (동일 영문에 대해 첫 번째 한글만 사용)
    renames = {}
    seen_eng = set()
    for kor, eng in COLUMN_MAPPING:
        if kor in df.columns and eng not in seen_eng:
            renames[kor] = eng
            seen_eng.add(eng)
    df = df.rename(columns=renames)
    return df


def find_weight_column(df: pd.DataFrame):
    for kw in WEIGHT_KEYWORDS:
        for c in df.columns:
            if kw in str(c):
                return c
    return None


def apply_serving_conversion(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    weight_col = find_weight_column(df)
    if weight_col is None:
        for col in NUTRIENT_COLS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
        print("⚖️ 기준 중량 컬럼 없음 → 100g 기준 값 유지")
        return df

    weight_series = pd.to_numeric(df[weight_col], errors="coerce").fillna(100)
    ratio = weight_series / 100.0

    for col in NUTRIENT_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
            df[col] = (df[col] * ratio).round(1)
    print(f"⚖️ '{weight_col}' 기준 1인분 환산 완료")
    return df


def add_clinical_insight(row: pd.Series) -> str:
    sodium = row.get("sodium") or 0
    sugar = row.get("sugar") or 0
    protein = row.get("protein") or 0
    parts = []
    if sodium >= 500:
        parts.append(f"1인분 기준 나트륨 {int(sodium)}mg로 고혈압 주의가 필요합니다.")
    if sugar >= 10:
        parts.append(f"당류 {sugar}g 포함으로 당뇨 관리 시 양을 조절하세요.")
    if protein >= 15:
        parts.append("단백질이 풍부해 근성장·유지에 도움이 됩니다.")
    if not parts:
        return "균형 잡힌 영양 성분입니다."
    return " ".join(parts)


def add_synthetic_qa(row: pd.Series) -> str:
    name = row.get("food_name") or ""
    cal = row.get("calories") or 0
    insight = row.get("clinical_insight") or ""
    return json.dumps({
        "question": f"{name}의 칼로리와 영양은?",
        "answer": f"1인분 기준 {cal}kcal이며, {insight}"
    }, ensure_ascii=False)


def main():
    path, fmt = find_raw_file()
    if path is None:
        print("❌ 현재 폴더에 raw_food_db.xlsx 또는 raw_food_db.numbers 파일이 없습니다.")
        return

    print(f"📥 파일 로드: {path.name} ({fmt})")
    df = load_dataframe(path, fmt)

    print("📋 컬럼 매핑 적용 중...")
    df = apply_column_mapping(df)

    # 7개 영문 컬럼이 모두 있어야 함
    missing = [c for c in ["food_name"] + NUTRIENT_COLS if c not in df.columns]
    if missing:
        print(f"❌ 다음 컬럼을 원본에서 찾을 수 없습니다: {missing}")
        print("   원본 컬럼 목록:", list(df.columns))
        return

    df = apply_serving_conversion(df)

    print("🩺 clinical_insight, synthetic_qa 생성 중...")
    df["clinical_insight"] = df.apply(add_clinical_insight, axis=1)
    df["synthetic_qa"] = df.apply(add_synthetic_qa, axis=1)

    out = df[FINAL_COLS].copy()
    out_path = Path(__file__).resolve().parent / OUTPUT_CSV
    out.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"✅ {OUTPUT_CSV} 저장 완료 (총 {len(out)}행)")


if __name__ == "__main__":
    main()
