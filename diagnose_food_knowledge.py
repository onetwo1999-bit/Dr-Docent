"""
Supabase food_knowledge 테이블 상태 진단
- 전체 데이터 개수
- embedding이 null인 행 개수
- food_name이 '짬뽕'인 행의 calories
"""
import os
from pathlib import Path

# 프로젝트 루트의 .env.local 로드 (있으면)
env_path = Path(__file__).resolve().parent / ".env.local"
if env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_path)
    except ImportError:
        pass

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "https://fddoizheudxxqescjpbq.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZG9pemhldWR4eHFlc2NqcGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5ODg4NTYsImV4cCI6MjA4NDU2NDg1Nn0.Bd59oGSV9JOZOR2Us5sy2B20bmrEUAvFyFJh5E9y-LE"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def diagnose():
    print("=" * 50)
    print("📊 food_knowledge 테이블 진단")
    print("=" * 50)

    # 1. 전체 데이터 개수 (count=exact로 Content-Range에서 전체 개수 반환)
    total = supabase.table("food_knowledge").select("id", count="exact").execute()
    total_count = getattr(total, "count", None)
    if total_count is None:
        total_count = len(total.data) if total.data else 0
        print("\n⚠️  전체 개수는 조회된 행 수만 표시됩니다 (API 기본 limit 적용).")
    print(f"\n1️⃣ 전체 데이터 개수: {total_count}개")

    # 2. embedding이 null인 행 개수
    null_embedding = supabase.table("food_knowledge").select("id", count="exact").is_("embedding", "null").execute()
    null_count = getattr(null_embedding, "count", None)
    if null_count is None:
        null_count = len(null_embedding.data) if null_embedding.data else 0
    print(f"2️⃣ embedding이 비어 있는(null) 행: {null_count}개")

    # 3. food_name이 '짬뽕'인 행의 calories
    jjamppong = supabase.table("food_knowledge").select("food_name, calories").eq("food_name", "짬뽕").execute()
    if jjamppong.data and len(jjamppong.data) > 0:
        row = jjamppong.data[0]
        cal = row.get("calories")
        print(f"3️⃣ food_name이 '짬뽕'인 행의 calories: {cal}")
    else:
        print("3️⃣ food_name이 '짬뽕'인 행: 없음")

    print("\n" + "=" * 50)
    if null_count > 0:
        print("⚠️  embedding이 비어 있는 행이 있습니다.")
        print("   아래 명령으로 generate_embeddings.py를 실행해 주세요:")
        print("   python generate_embeddings.py")
        print("=" * 50)
    else:
        print("✅ 모든 행에 임베딩이 있습니다.")
        print("=" * 50)


if __name__ == "__main__":
    try:
        diagnose()
    except Exception as e:
        print(f"❌ 진단 중 오류: {e}")
        raise
