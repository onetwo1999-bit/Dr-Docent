# medical_papers RAG 설정 가이드

## 1. Supabase 설정

1. **pgvector 확장 활성화**
   - Supabase Dashboard → Database → Extensions
   - `vector` 검색 후 활성화

2. **테이블 및 RPC 생성**
   - SQL Editor에서 `supabase/medical-papers-schema.sql` 실행

## 2. 환경 변수

`.env.local` 또는 Vercel 환경 변수에 추가:

| 변수 | 설명 |
|------|------|
| `PUBMED_API_KEY` | PubMed E-utilities (자동 피딩용, 없으면 피딩 비활성화) |
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar API (인용·TLDR 수집) |
| `SUPABASE_SERVICE_ROLE_KEY` | medical_papers INSERT 및 Python 스크립트용 |
| `OPENAI_API_KEY` | 임베딩 생성용 (기존) |

## 3. 동작 흐름

- **채팅**: 유저 질문 시 RAG로 관련 논문 검색 → 닥터 도슨트가 논문 근거로 답변
- **자동 피딩**: 채팅 시 백그라운드에서 PubMed/Semantic Scholar로 논문 수집 후 DB 저장
- **수동 피딩**: `POST /api/medical-papers/feed` + `{ "query": "한국인 췌장 특성" }`

## 4. Python 청킹/임베딩 유틸 (수동 저장용)

```bash
cd scripts/medical_papers
pip install -r requirements.txt
python chunk_and_embed.py --pmid 12345 --title "논문 제목" --abstract "초록 텍스트..." --citation_count 10 --tldr "AI 요약"
```
