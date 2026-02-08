-- =====================================================
-- 📚 medical_papers - RAG용 의학 논문 지식 저장소
-- pgvector 확장 필요: Supabase Dashboard > Extensions > vector 활성화
-- =====================================================

-- pgvector 확장 활성화 (이미 활성화돼 있으면 무시됨)
CREATE EXTENSION IF NOT EXISTS vector;

-- medical_papers 테이블
-- embedding: OpenAI text-embedding-3-small (1536차원) 또는 text-embedding-ada-002 (1536차원)
CREATE TABLE IF NOT EXISTS medical_papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pmid TEXT,
  title TEXT NOT NULL,
  abstract TEXT,
  citation_count INTEGER DEFAULT 0,
  tldr TEXT,
  chunk_index INTEGER DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 벡터 유사도 검색을 위한 HNSW 인덱스 (cosine distance)
CREATE INDEX IF NOT EXISTS idx_medical_papers_embedding 
  ON medical_papers USING hnsw (embedding vector_cosine_ops);

-- pmid + chunk_index 유니크 (같은 논문의 청크 구분)
CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_papers_pmid_chunk 
  ON medical_papers(pmid, chunk_index) WHERE pmid IS NOT NULL;

-- pmid, citation_count로 검색/정렬용 인덱스
CREATE INDEX IF NOT EXISTS idx_medical_papers_pmid ON medical_papers(pmid);
CREATE INDEX IF NOT EXISTS idx_medical_papers_citation_count ON medical_papers(citation_count DESC);

-- RLS: 공개 읽기 (로그인 사용자만), 서비스 롤만 쓰기
ALTER TABLE medical_papers ENABLE ROW LEVEL SECURITY;

-- 로그인한 사용자는 조회 가능
DROP POLICY IF EXISTS "Allow read for authenticated" ON medical_papers;
CREATE POLICY "Allow read for authenticated" ON medical_papers 
  FOR SELECT USING (auth.role() = 'authenticated');

-- insert/update/delete는 service_role 키로 API에서 수행 (RLS 우회됨)

-- 벡터 유사도 검색 RPC
CREATE OR REPLACE FUNCTION match_medical_papers(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  pmid text,
  title text,
  abstract text,
  citation_count int,
  tldr text,
  chunk_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.id,
    mp.pmid,
    mp.title,
    mp.abstract,
    mp.citation_count,
    mp.tldr,
    mp.chunk_text,
    1 - (mp.embedding <=> query_embedding) AS similarity
  FROM medical_papers mp
  WHERE mp.embedding IS NOT NULL
    AND 1 - (mp.embedding <=> query_embedding) > match_threshold
  ORDER BY mp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 코멘트
COMMENT ON TABLE medical_papers IS 'RAG용 의학 논문 초록 청크. chunk_text 단위로 벡터 검색';
COMMENT ON COLUMN medical_papers.pmid IS 'PubMed ID';
COMMENT ON COLUMN medical_papers.tldr IS 'Semantic Scholar AI 요약';
COMMENT ON COLUMN medical_papers.chunk_text IS '초록 청킹 후 텍스트 (embedding 소스)';
