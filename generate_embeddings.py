"""
Supabase food_knowledge 테이블에 OpenAI 임베딩(지능) 주입

사용 방법:
  1) 같은 폴더에 .env.local 에 다음 키가 있어야 합니다.
       NEXT_PUBLIC_SUPABASE_URL
       NEXT_PUBLIC_SUPABASE_ANON_KEY
       OPENAI_API_KEY
  2) 실행: python generate_embeddings.py
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client


BATCH_SIZE = 50
TABLE_NAME = "food_knowledge"
EMBEDDING_MODEL = "text-embedding-3-small"


def load_env():
    env_path = Path(__file__).resolve().parent / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    missing = []
    if not url:
        missing.append("NEXT_PUBLIC_SUPABASE_URL")
    if not key:
        missing.append("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not openai_key:
        missing.append("OPENAI_API_KEY")

    if missing:
        raise RuntimeError(
            "❌ 다음 환경 변수가 비어 있거나 없습니다: " + ", ".join(missing) + "\n"
            ".env.local 파일을 확인해 주세요."
        )

    return url, key, openai_key


def run_batch(supabase, client):
    response = (
        supabase.table(TABLE_NAME)
        .select("*")
        .is_("embedding", "null")
        .limit(BATCH_SIZE)
        .execute()
    )
    rows = response.data

    if not rows:
        print("🎉 모든 작업 완료!")
        return False

    print(f"🔄 {len(rows)}개 처리 중... (남은 데이터 처리 중)")

    for row in rows:
        food_name = row.get("food_name") or ""
        calories = row.get("calories")
        clinical_insight = row.get("clinical_insight") or ""
        row_id = row.get("id")

        if row_id is None:
            print("  ⚠️ id가 없는 행 건너뜀")
            continue

        input_text = f"식품명: {food_name}, 칼로리: {calories}kcal, 특징: {clinical_insight}"

        try:
            res = client.embeddings.create(
                input=input_text,
                model=EMBEDDING_MODEL,
            )
            embedding = res.data[0].embedding
            supabase.table(TABLE_NAME).update({"embedding": embedding}).eq("id", row_id).execute()
            print(f"  ✨ {food_name}")
        except Exception as e:
            print(f"  🚨 에러 ({food_name}, id={row_id}): {e}")
            # 다음 행으로 계속 진행

    return True


def main():
    try:
        url, key, openai_key = load_env()
        print("🔗 환경 변수 로드 완료")
    except RuntimeError as e:
        print(e)
        return

    supabase = create_client(url, key)
    client = OpenAI(api_key=openai_key)

    print("🔍 embedding이 비어 있는 행을 찾아 임베딩을 주입합니다.\n")

    while run_batch(supabase, client):
        pass


if __name__ == "__main__":
    main()
