'use client'

import { ExternalLink, FileText } from 'lucide-react'

export type Reference = {
  title: string
  pmid: string | null
  authors?: string
  abstract?: string
  citation_count?: number
  tldr?: string | null
}

interface ReferencesSidebarProps {
  references: Reference[]
  isLoading?: boolean
}

export default function ReferencesSidebar({ references, isLoading }: ReferencesSidebarProps) {
  return (
    <aside className="w-80 flex-shrink-0 border-l border-gray-100 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#2DD4BF]" />
          References
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          PubMed &amp; Semantic Scholar 검색 결과
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && references.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-[#2DD4BF] font-medium animate-pulse mb-3">
              최신 논문을 분석 중입니다...
            </p>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-100 bg-gray-50 p-4 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-2/3 mt-1" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && references.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>질문을 보내면 관련 논문이 여기에 표시됩니다</p>
          </div>
        )}

        {references.length > 0 && references.map((ref, idx) => {
          const summary = ref.abstract || ref.tldr || ''
          const content = (
            <>
              <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 mb-2">
                {ref.title}
              </h3>
              {ref.authors && (
                <p className="text-xs text-gray-500 mb-1 line-clamp-1">{ref.authors}</p>
              )}
              <div className="flex items-center justify-between gap-2 mb-2">
                {typeof ref.citation_count === 'number' && ref.citation_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2DD4BF] bg-[#2DD4BF]/10 px-2 py-0.5 rounded-full">
                    {ref.citation_count.toLocaleString()} citations
                  </span>
                )}
                {ref.pmid && <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-auto" />}
              </div>
              {summary && (
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                  {summary}
                </p>
              )}
            </>
          )
          return (
            <div
              key={idx}
              className={`rounded-xl border border-gray-100 transition-all hover:shadow-md hover:border-[#2DD4BF]/30 ${
                ref.pmid ? 'cursor-pointer' : ''
              }`}
            >
              {ref.pmid ? (
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-gradient-to-br from-white to-gray-50/50 rounded-xl"
                >
                  {content}
                </a>
              ) : (
                <div className="p-4 bg-gradient-to-br from-white to-gray-50/50 rounded-xl">
                  {content}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
