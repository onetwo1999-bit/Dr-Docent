"""
Supabase food_knowledge 임베딩 — 아직 지능이 주입되지 않은 데이터만 처리

[강제 규칙]
- SELECT 시 절대 전체 조회 금지. 반드시 WHERE embedding IS NULL 사용.
- CSV 파일 사용 금지. 수파베이스 DB에 직접 접속해 embedding이 비어 있는 행만 실시간 조회. DB(Supabase) 서버 단계에서 미리 필터링해서 가져와(Server-side filtering).
- 시작 전 '총 N건의 새로운 데이터를 발견했습니다. 임베딩을 시작할까요?' 출력 후 대기.
- 오늘 날짜(created_at)로만 제한: 오늘 업로드한 약 3,300건만 임베딩. 25만 건 전체 조회 금지.
"""

import os
import asyncio
import httpx
from pathlib import Path
from datetime import datetime, timedelta

from dotenv import load_dotenv

try:
    from zoneinfo import ZoneInfo
    _TZ = ZoneInfo("Asia/Seoul")
except ImportError:
    _TZ = None  # Python < 3.9: 로컬 날짜 사용


def _today_created_at_range():
    """오늘 날짜(한국 기준) 00:00 ~ 내일 00:00 ISO 문자열. created_at 필터용."""
    if _TZ:
        now = datetime.now(_TZ)
    else:
        now = datetime.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start.isoformat(), end.isoformat()


from supabase import create_client

env_path = Path(__file__).resolve().parent / ".env.local"
load_dotenv(dotenv_path=env_path)

URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").strip()
KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

if not URL or not KEY or not OPENAI_API_KEY:
    print("🚨 [설정 에러] .env.local 에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY 가 필요합니다.")
    exit(1)

supabase = create_client(URL, KEY)

FETCH_BATCH = 50
PARALLEL = 10
OPENAI_TIMEOUT = 60.0
MAX_RETRIES = 3
RETRY_WAIT = 2.0
LOG_EVERY = 100


def _v(row, key, default=""):
    val = row.get(key)
    if val is None or (isinstance(val, float) and str(val) == "nan"):
        return default
    if isinstance(val, float):
        return int(val) if val == int(val) else round(val, 2)
    return val


def build_embedding_text(row: dict) -> str:
    """RDA 영양소(에너지·단백질·지방·탄수화물·당·식이섬유·류신·오메가3/6·칼슘·철·비타민C·임상인사이트)를 문장에 포함."""
    name = (row.get("food_name") or "").strip() or "식품"
    unit = _v(row, "unit") or "100g"
    cal = _v(row, "calories", 0)
    protein = _v(row, "protein", 0)
    fat = _v(row, "fat", 0)
    carbs = _v(row, "carbs", 0)
    sugar = _v(row, "sugar", 0)
    fiber = _v(row, "fiber", 0)
    leucine = _v(row, "leucine", 0)
    omega3 = _v(row, "omega3", 0)
    omega6 = _v(row, "omega6", 0)
    calcium = _v(row, "calcium", 0)
    iron = _v(row, "iron", 0)
    vit_c = _v(row, "vit_c", 0)
    clinical = (row.get("clinical_insight") or "").strip()

    # 기본: 에너지, 단백질, 지방, 탄수화물, 당, 식이섬유
    parts = [f"{name} {unit}에는 에너지 {cal}kcal, 단백질 {protein}g"]
    if fat or carbs:
        parts.append(f", 지방 {fat}g, 탄수화물 {carbs}g")
    if sugar:
        parts.append(f", 당 {sugar}g")
    if fiber:
        parts.append(f", 식이섬유 {fiber}g")
    parts.append("가 들어 있습니다.")
    # 상세 영양소: 류신(근육 합성), 오메가3/6(심혈관), 칼슘·철·비타민C
    if leucine:
        parts.append(f" 근육 합성에 도움이 되는 류신 {leucine}mg 포함.")
    if omega3 or omega6:
        parts.append(f" 혈관·심혈관 건강에 도움을 주는 오메가3 {omega3}g, 오메가6 {omega6}g 함유.")
    if calcium or iron:
        parts.append(f" 칼슘 {calcium}mg, 철 {iron}mg.")
    if vit_c:
        parts.append(f" 비타민C {vit_c}mg.")
    if clinical:
        parts.append(f" {clinical}")

    return "".join(parts).strip()


async def get_embedding_async(client: httpx.AsyncClient, text: str, row_id: int):
    """비동기 임베딩 요청. 성공 시 (row_id, embedding), 실패 시 (row_id, None)."""
    api_url = "https://api.openai.com/v1/embeddings"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_API_KEY}"}
    body = {"input": text, "model": "text-embedding-3-small"}

    for attempt in range(MAX_RETRIES):
        try:
            resp = await client.post(api_url, json=body, headers=headers, timeout=OPENAI_TIMEOUT)
            if resp.status_code == 200:
                return row_id, resp.json()["data"][0]["embedding"]
            if resp.status_code == 429:
                await asyncio.sleep(RETRY_WAIT * (2 ** attempt))
                continue
            return row_id, None
        except (httpx.ReadError, httpx.ConnectError, httpx.TimeoutException):
            await asyncio.sleep(RETRY_WAIT * (2 ** attempt))
        except Exception:
            return row_id, None
    return row_id, None


def update_one(row_id: int, embedding: list) -> bool:
    """이미 존재하는 행의 embedding 컬럼만 업데이트 (upsert/insert 없음)."""
    try:
        supabase.table("food_knowledge").update({"embedding": embedding}).eq("id", row_id).execute()
        return True
    except Exception:
        return False


async def main():
    # ─── 데이터 소스: CSV 사용 금지. 수파베이스 DB만 사용. 오늘(created_at)만 조회. ───
    today_start_iso, tomorrow_start_iso = _today_created_at_range()
    print("🚀 임베딩 작업 (DB 서버 필터: embedding IS NULL + created_at 오늘 날짜만)")
    print(f"   📅 조회 기간: created_at >= {today_start_iso} ~ < {tomorrow_start_iso}")

    # [1] 카운트: WHERE embedding IS NULL AND created_at 오늘
    total_null = None
    try:
        r = (
            supabase.table("food_knowledge")
            .select("id", count="exact")
            .is_("embedding", "null")
            .gte("created_at", today_start_iso)
            .lt("created_at", tomorrow_start_iso)
            .limit(1)
            .execute()
        )
        total_null = getattr(r, "count", None)
    except Exception as e:
        print(f"   ⚠️ 건수 조회 실패: {e}")
        return

    if total_null is None:
        total_null = 0
    print(f"📋 해당 조건(embedding IS NULL + 오늘 created_at)으로 조회된 데이터: 총 {total_null:,}건 (약 3,330건 예상)")
    print("임베딩을 시작할까요? 승인 후 진행합니다.")
    try:
        answer = input("시작하려면 Enter, 종료하려면 q 입력 후 Enter: ").strip().lower()
        if answer == "q":
            print("종료합니다.")
            return
    except EOFError:
        pass
    print("승인되었습니다. 임베딩을 시작합니다.")

    # [2] 배치 조회: WHERE embedding IS NULL AND created_at 오늘
    select_cols = (
        "id, food_name, unit, calories, protein, fat, carbs, sugar, fiber, "
        "calcium, iron, leucine, omega3, omega6, vit_c, clinical_insight"
    )
    limits = httpx.Limits(max_connections=20)
    timeout = httpx.Timeout(OPENAI_TIMEOUT)
    total_done = 0

    async with httpx.AsyncClient(limits=limits, timeout=timeout, http2=False) as client:
        while True:
            try:
                # WHERE embedding IS NULL AND created_at 오늘 (25만 건 전체 조회 금지)
                res = (
                    supabase.table("food_knowledge")
                    .select(select_cols)
                    .is_("embedding", "null")
                    .gte("created_at", today_start_iso)
                    .lt("created_at", tomorrow_start_iso)
                    .limit(FETCH_BATCH)
                    .execute()
                )
                rows = res.data or []
            except Exception as e:
                print(f"   🚨 조회 실패: {e}")
                await asyncio.sleep(RETRY_WAIT)
                continue

            if not rows:
                print("🎉 오늘(created_at) 기준 embedding null인 데이터 모두 처리 완료!")
                break

            # 배치 내 병렬: 최대 PARALLEL개 동시 요청
            sem = asyncio.Semaphore(PARALLEL)

            async def task(row):
                rid = row["id"]
                text = build_embedding_text(row)
                async with sem:
                    return await get_embedding_async(client, text, rid)

            tasks = [task(r) for r in rows]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for r in results:
                if isinstance(r, Exception):
                    continue
                row_id, emb = r
                if emb and update_one(row_id, emb):
                    total_done += 1

            if total_done and total_done % LOG_EVERY < FETCH_BATCH:
                print(f"   … {total_done}건 완료 / 대상 약 {total_null or '?'}건")

    print(f"✅ 총 {total_done}건 임베딩 처리 완료.")


if __name__ == "__main__":
    asyncio.run(main())
