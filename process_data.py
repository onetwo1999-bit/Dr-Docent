import json
import pandas as pd
from numbers_parser import Document
from pathlib import Path
import glob

def main():
    # 1. 파일 찾기
    files = glob.glob("*.numbers")
    if not files: return print("❌ .numbers 파일이 없습니다.")
    
    doc = Document(files[0])
    table = doc.sheets[0].tables[0]
    data = [[cell.value for cell in row] for row in table.rows()]
    df = pd.DataFrame(data[1:], columns=data[0])

    # 2. 수파베이스 테이블과 일치하는 영문 헤더로 변경
    mapping = {
        "식품명": "food_name", "에너지(kcal)": "calories", "단백질(g)": "protein",
        "지방(g)": "fat", "탄수화물(g)": "carbs", "당류(g)": "sugar", "나트륨(mg)": "sodium"
    }
    df = df.rename(columns=mapping)

    # 3. 1인분 환산 로직 (중량 컬럼 자동 탐색)
    weight_cols = [c for c in df.columns if any(kw in str(c) for kw in ["1회제공량", "중량", "내용량"])]
    if weight_cols:
        weight_val = pd.to_numeric(df[weight_cols[0]], errors='coerce').fillna(100)
        ratio = weight_val / 100
        for col in ["calories", "protein", "fat", "carbs", "sugar", "sodium"]:
            if col in df.columns:
                df[col] = (pd.to_numeric(df[col], errors='coerce').fillna(0) * ratio).round(1)
        print(f"⚖️ {weight_cols[0]} 기준으로 1인분 환산 완료!")

    # 4. 인사이트 및 QA 생성
    df['clinical_insight'] = df.apply(lambda r: f"1인분 기준 나트륨 {r['sodium']}mg 함유 식품입니다.", axis=1)
    df['synthetic_qa'] = df.apply(lambda r: json.dumps({"q": f"{r['food_name']} 영양은?", "a": f"{r['calories']}kcal입니다."}, ensure_ascii=False), axis=1)

    # 5. 수파베이스 전용 컬럼만 추출 (매우 중요!)
    final_cols = ["food_name", "calories", "protein", "fat", "carbs", "sugar", "sodium", "clinical_insight", "synthetic_qa"]
    df[final_cols].to_csv("processed_food_db.csv", index=False, encoding="utf-8-sig")
    print("✅ processed_food_db.csv 생성 성공!")

if __name__ == "__main__":
    main()
    