#!/usr/bin/env python3
"""
논문 초록을 청킹(Chunking)하고 벡터로 변환한 뒤 Supabase medical_papers 테이블에 저장합니다.

필요 환경 변수:
  - OPENAI_API_KEY: 임베딩 생성용
  - NEXT_PUBLIC_SUPABASE_URL: Supabase 프로젝트 URL
  - SUPABASE_SERVICE_ROLE_KEY: medical_papers INSERT용 (RLS 우회)

사용 예:
  python chunk_and_embed.py --pmid 12345 --title "..." --abstract "..." [--citation_count 10] [--tldr "..."]
  python chunk_and_embed.py --json '{"pmid":"12345","title":"...","abstract":"..."}'
"""

import os
import sys
import json
import argparse
import hashlib
from pathlib import Path

# 프로젝트 루트의 .env 로드
root = Path(__file__).resolve().parent.parent.parent
env_path = root / ".env.local" if (root / ".env.local").exists() else root / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

CHUNK_SIZE = 500
CHUNK_OVERLAP = 80
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """텍스트를 겹침 있는 청크로 분할합니다."""
    if not text or not text.strip():
        return []
    text = text.strip()
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if end < len(text):
            # 문장 경계에 맞추기 (마침표/줄바꿈)
            last_period = chunk.rfind(".")
            last_newline = chunk.rfind("\n")
            cut = max(last_period, last_newline)
            if cut > chunk_size // 2:
                chunk = chunk[: cut + 1]
                end = start + cut + 1
        chunks.append(chunk.strip())
        start = end - overlap
    return [c for c in chunks if c]


def get_embedding(client, text: str) -> list[float]:
    """OpenAI API로 텍스트의 임베딩 벡터를 생성합니다."""
    r = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text[:8000],
    )
    return r.data[0].embedding


def upsert_paper(
    supabase,
    pmid: str | None,
    title: str,
    abstract: str,
    citation_count: int = 0,
    tldr: str | None = None,
) -> int:
    """
    논문을 청킹 후 임베딩을 생성해 medical_papers 테이블에 Upsert합니다.
    Returns: 저장된 청크 수
    """
    from openai import OpenAI

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    if not client.api_key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

    chunks = chunk_text(abstract)
    if not chunks:
        chunks = chunk_text(title)  # abstract 없으면 title만
    if not chunks:
        return 0

    rows = []
    for i, chunk in enumerate(chunks):
        emb = get_embedding(client, chunk)
        rows.append({
            "pmid": pmid,
            "title": title,
            "abstract": abstract if len(abstract) < 10000 else abstract[:10000],
            "citation_count": citation_count,
            "tldr": (tldr or "")[:2000],
            "chunk_index": i,
            "chunk_text": chunk,
            "embedding": emb,
        })

    # 기존 청크 삭제 후 새로 삽입
    if pmid:
        supabase.table("medical_papers").delete().eq("pmid", pmid).execute()
    else:
        # pmid 없으면 title+abstract 해시로 기존 레코드 삭제
        h = hashlib.sha256((title + abstract).encode()).hexdigest()[:16]
        supabase.table("medical_papers").delete().eq("pmid", f"hash-{h}").execute()

    if rows:
        # pmid 없을 때 청크에 일관된 source id 부여
        if not pmid:
            h = hashlib.sha256((title + abstract).encode()).hexdigest()[:16]
            for r in rows:
                r["pmid"] = f"hash-{h}"
        supabase.table("medical_papers").insert(rows).execute()

    return len(rows)


def main():
    parser = argparse.ArgumentParser(description="논문 청킹 후 임베딩 생성 및 DB 저장")
    parser.add_argument("--pmid", type=str, help="PubMed ID")
    parser.add_argument("--title", type=str, required=True, help="논문 제목")
    parser.add_argument("--abstract", type=str, default="", help="초록")
    parser.add_argument("--citation_count", type=int, default=0, help="인용 수")
    parser.add_argument("--tldr", type=str, default="", help="AI 요약(TLDR)")
    parser.add_argument("--json", type=str, help='JSON: {"pmid","title","abstract","citation_count","tldr"}')
    args = parser.parse_args()

    if args.json:
        data = json.loads(args.json)
        pmid = data.get("pmid")
        title = data.get("title", "")
        abstract = data.get("abstract", "")
        citation_count = data.get("citation_count", 0)
        tldr = data.get("tldr", "")
    else:
        pmid = args.pmid
        title = args.title
        abstract = args.abstract
        citation_count = args.citation_count
        tldr = args.tldr

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요", file=sys.stderr)
        sys.exit(1)

    from supabase import create_client
    supabase = create_client(url, key)

    count = upsert_paper(
        supabase,
        pmid=pmid,
        title=title,
        abstract=abstract,
        citation_count=citation_count,
        tldr=tldr,
    )
    print(f"저장 완료: {count}개 청크")


if __name__ == "__main__":
    main()
