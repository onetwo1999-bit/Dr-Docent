"""
docent_master_db.json → Supabase exercises 테이블 업로드

- 각 운동의 설명글을 OpenAI 임베딩 API로 벡터 변환
- exercises 테이블에 저장

필요: .env.local
  - NEXT_PUBLIC_SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY (권장, RLS 우회) 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY
  - OPENAI_API_KEY

사용:
  python3 upload_exercises_to_supabase.py          # 전체 (물리치료 4컬럼 포함)
  python3 upload_exercises_to_supabase.py --minimal # anatomical_focus 등 4컬럼 제외 (테이블에 없을 때)
"""

import argparse
import json
import os
import time
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from supabase import create_client

env_path = Path(__file__).resolve().parent / ".env.local"
load_dotenv(dotenv_path=env_path)

URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").strip()
# INSERT는 RLS 우회가 필요할 수 있어 service_role 우선 사용
KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "").strip()
)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

if not URL or not KEY or not OPENAI_API_KEY:
    print("🚨 .env.local 에 NEXT_PUBLIC_SUPABASE_URL, (SUPABASE_SERVICE_ROLE_KEY 또는 ANON_KEY), OPENAI_API_KEY 가 필요합니다.")
    exit(1)

DB_PATH = Path(__file__).resolve().parent / "docent_master_db.json"
EMBEDDING_MODEL = "text-embedding-3-small"
BATCH_DELAY = 0.3


def build_embedding_text(ex: dict) -> str:
    """임베딩용 설명 텍스트: 운동명 + 전문 필드 통합."""
    parts = [
        ex.get("name") or "",
        ex.get("korean_name") or "",
        ex.get("biomechanical_rationale") or "",
        ex.get("clinical_insight") or "",
        ex.get("regression_progression") or "",
        ex.get("red_flags") or "",
        ex.get("time_under_tension") or "",
        ex.get("kinetic_chain") or "",
    ]
    if ex.get("proprioception_tip"):
        parts.append(ex["proprioception_tip"])
    if ex.get("anatomical_focus"):
        parts.append(ex["anatomical_focus"])
    if ex.get("biomechanical_limit"):
        parts.append(ex["biomechanical_limit"])
    if ex.get("expert_rationale"):
        parts.append(ex["expert_rationale"])
    contraindication = ex.get("clinical_contraindication")
    if isinstance(contraindication, list) and contraindication:
        parts.append(" 금기: " + ", ".join(str(c) for c in contraindication))
    primary = ex.get("primaryMuscles") or []
    secondary = ex.get("secondaryMuscles") or []
    if primary:
        parts.append(" 주동근: " + ", ".join(primary))
    if secondary:
        parts.append(" 보조근육: " + ", ".join(secondary))
    return " ".join(str(p) for p in parts if p).strip()[:8000]


def get_embedding(text: str) -> Optional[List[float]]:
    """OpenAI Embedding API로 벡터 생성."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        r = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text[:8000],
        )
        return r.data[0].embedding
    except Exception as e:
        print(f"   ⚠️ 임베딩 실패: {e}")
        return None


def to_db_row(ex: dict, include_pt_fields: bool = True) -> dict:
    """JSON 운동 객체 → DB 행 변환. include_pt_fields=False 시 물리치료 4컬럼 제외."""
    row = {
        "name": ex.get("name") or "",
        "korean_name": ex.get("korean_name"),
        "force": ex.get("force"),
        "level": ex.get("level"),
        "mechanic": ex.get("mechanic"),
        "equipment": ex.get("equipment"),
        "primary_muscles": ex.get("primaryMuscles") or [],
        "secondary_muscles": ex.get("secondaryMuscles") or [],
        "instructions": ex.get("instructions") or [],
        "category": ex.get("category"),
        "biomechanical_rationale": ex.get("biomechanical_rationale"),
        "clinical_insight": ex.get("clinical_insight"),
        "regression_progression": ex.get("regression_progression"),
        "red_flags": ex.get("red_flags"),
        "kinetic_chain": ex.get("kinetic_chain"),
        "time_under_tension": ex.get("time_under_tension"),
        "proprioception_tip": ex.get("proprioception_tip"),
    }
    if include_pt_fields:
        row["anatomical_focus"] = ex.get("anatomical_focus")
        row["biomechanical_limit"] = ex.get("biomechanical_limit")
        row["clinical_contraindication"] = ex.get("clinical_contraindication") or []
        row["expert_rationale"] = ex.get("expert_rationale")
    text = build_embedding_text(ex)
    emb = get_embedding(text)
    if emb:
        row["embedding"] = emb
    return row


def main():
    parser = argparse.ArgumentParser(description="docent_master_db.json → Supabase exercises 업로드")
    parser.add_argument(
        "--minimal",
        action="store_true",
        help="물리치료 4컬럼(anatomical_focus 등) 제외. exercises 테이블에 해당 컬럼이 없을 때 사용",
    )
    args = parser.parse_args()
    include_pt_fields = not args.minimal

    if not DB_PATH.exists():
        print(f"❌ {DB_PATH} 파일이 없습니다. build_docent_master_db.py 를 먼저 실행하세요.")
        return

    with open(DB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    exercises = data.get("exercises", [])
    total = len(exercises)
    mode = "minimal (물리치료 4컬럼 제외)" if args.minimal else "전체"
    print(f"📂 docent_master_db.json 로드: 총 {total}건 [{mode}]")

    supabase = create_client(URL, KEY)
    done = 0
    for i, ex in enumerate(exercises):
        name = ex.get("name") or ex.get("korean_name") or f"#{i+1}"
        try:
            row = to_db_row(ex, include_pt_fields=include_pt_fields)
            supabase.table("exercises").insert(row).execute()
            done += 1
            print(f"   [{done}/{total}] {name} 업로드 완료")
        except Exception as e:
            print(f"   🚨 {name} 업로드 실패: {e}")
        time.sleep(BATCH_DELAY)

    print(f"✅ 총 {done}/{total}건 exercises 테이블에 저장 완료.")


if __name__ == "__main__":
    main()
