import os
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

# 1. 환경 변수 로드 (.env.local 우선)
load_dotenv(dotenv_path=".env.local")

URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "여기에_URL_직접_입력"
KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "여기에_KEY_직접_입력"

supabase = create_client(URL, KEY)

def diagnose():
    print("\n🏥 [닥터 도슨트 데이터 정밀 진단 시작]")
    print("-" * 40)

    # 1. 전체 데이터 개수
    res_total = supabase.table("food_knowledge").select("id", count="exact").execute()
    total_count = res_total.count
    print(f"📊 전체 데이터 개수: {total_count}건")

    # 2. 임베딩이 비어있는(null) 행 개수
    res_null = supabase.table("food_knowledge").select("id", count="exact").is_("embedding", "null").execute()
    null_count = res_null.count
    print(f"🧠 임베딩 대기 중(null): {null_count}건")

    # 3. 짬뽕 칼로리 확인
    res_jjambong = supabase.table("food_knowledge").select("calories").eq("food_name", "짬뽕").execute()
    if res_jjambong.data:
        cal = res_jjambong.data[0]['calories']
        print(f"🍜 짬뽕 칼로리 진단: {cal} kcal")
        if cal < 100:
            print("   ⚠️ 경고: 칼로리가 너무 낮습니다. 100g당 기준인 것 같습니다!")
        else:
            print("   ✅ 정상: 1인분 기준으로 환산된 것 같습니다.")
    else:
        print("🍜 짬뽕 데이터를 찾을 수 없습니다.")

    print("-" * 40)

    # 4. 후속 조치 안내
    if null_count > 0:
        print(f"🚨 진단 결과: 지능(임베딩) 주입이 필요합니다.")
        print(f"👉 터미널에 다음을 입력하세요: python3 generate_embeddings.py")
    else:
        print("✅ 진단 결과: 모든 데이터가 건강하며 지능 주입이 완료되었습니다!")

if __name__ == "__main__":
    diagnose()
    