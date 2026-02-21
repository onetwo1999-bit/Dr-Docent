'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, ArrowLeft, ExternalLink, Square } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import MedicalDisclaimer from '@/app/components/MedicalDisclaimer'
import { isAnalysisIntent, isForcedSearchTrigger } from '@/lib/medical-papers/intent'
import { useAppContextStore } from '@/store/useAppContextStore'
import { createClient } from '@/utils/supabase/client'

export interface Reference {
  title: string
  pmid: string | null
  url?: string
  journal?: string
  authors?: string
  abstract?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  papers?: Reference[]
}

interface ChatInterfaceProps {
  userId: string
  initialNickname: string | null
  /** nickname 없을 때 폴백 — 이메일 앞부분 또는 '사용자' */
  emailPrefix: string
}

const SCROLL_BOTTOM_THRESHOLD = 120
const TYPEWRITER_INTERVAL_MS = 36
const LOADING_MESSAGE = '최적의 솔루션을 위한 답변을 구성하고 있습니다.'

/** API papers 배열을 Reference 형태로 정규화 (말풍선 하단 출처용) */
function normalizePapers(papers: unknown): Reference[] {
  if (!Array.isArray(papers)) return []
  return papers.map((p: Record<string, unknown>) => ({
    title: typeof p.title === 'string' ? p.title : '',
    pmid: p.pmid != null ? String(p.pmid) : null,
    url: typeof p.url === 'string' ? p.url : (p.pmid != null ? `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/` : undefined),
    journal: typeof p.journal === 'string' ? p.journal : undefined,
    authors: typeof p.authors === 'string' ? p.authors : undefined,
    abstract: typeof p.abstract === 'string' ? p.abstract : undefined,
  }))
}

/** profiles.nickname → 표시 이름 결정. 없으면 emailPrefix 폴백 */
function resolveDisplayName(nickname: string | null, emailPrefix: string): string {
  return nickname?.trim() || emailPrefix
}

/** 초기 인사말 생성 */
function buildGreeting(displayName: string): string {
  return `안녕하세요, ${displayName}님! 👋\n닥터 도슨 AI 건강 상담사입니다.\n건강에 관한 궁금한 점을 물어보세요.`
}

export default function ChatInterface({ userId, initialNickname, emailPrefix }: ChatInterfaceProps) {
  const getRecentActionsForAPI = useAppContextStore((s) => s.getRecentActionsForAPI)
  const getHesitationHint = useAppContextStore((s) => s.getHesitationHint)

  // ─── 닉네임 Realtime 상태 ───────────────────────────────
  const [nickname, setNickname] = useState<string | null>(initialNickname)
  const displayName = resolveDisplayName(nickname, emailPrefix)

  // Supabase Realtime 구독 — profiles UPDATE 감지
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`chat:profiles:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          const newNick = (payload.new as { nickname?: string | null }).nickname ?? null
          setNickname(newNick)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // 닉네임이 바뀌면 첫 번째 인사 메시지도 즉시 갱신
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 0 || prev[0].role !== 'assistant') return prev
      const next = [...prev]
      next[0] = { ...next[0], content: buildGreeting(resolveDisplayName(nickname, emailPrefix)) }
      return next
    })
  }, [nickname, emailPrefix])
  // ──────────────────────────────────────────────────────

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: buildGreeting(displayName)
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  /** 사용자가 스크롤을 맨 아래에 두었을 때만 true → 조건부 자동 스크롤용 */
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isAtBottomRef = useRef(true)
  const [typewriterJob, setTypewriterJob] = useState<{ fullText: string; assistantIndex: number } | null>(null)
  const answerPendingDisplayRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const isStreaming = isLoading || typewriterJob !== null

  useEffect(() => {
    isAtBottomRef.current = isAtBottom
  }, [isAtBottom])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  /** 스크롤 위치가 맨 아래 근처인지 (사용자 스크롤 상태 감지) */
  const handleScroll = useCallback(() => {
    const el = chatScrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const atBottom = scrollHeight - scrollTop - clientHeight < SCROLL_BOTTOM_THRESHOLD
    setIsAtBottom(atBottom)
  }, [])

  /** 답변 스트리밍 중에는 자동 스크롤 안 함 → 스크롤 자유. 새 메시지 추가 시(맨 아래 있을 때만) 한 번만 스크롤 */
  useEffect(() => {
    if (typewriterJob) return
    if (!isLoading) return
    if (isAtBottomRef.current) scrollToBottom()
  }, [messages, isLoading, typewriterJob, scrollToBottom])

  useEffect(() => {
    if (!typewriterJob) return
    const { fullText, assistantIndex: idx } = typewriterJob
    let len = 0
    const timer = setInterval(() => {
      len += 1
      setMessages(prev => {
        const next = [...prev]
        if (next[idx]?.role === 'assistant') {
          next[idx] = { ...next[idx], content: fullText.slice(0, len) }
        }
        return next
      })
      if (len === 1) {
        setTimeout(() => setIsLoading(false), 0)
      }
      if (len >= fullText.length) {
        clearInterval(timer)
        setTypewriterJob(null)
      }
    }, TYPEWRITER_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [typewriterJob])

  const handleStop = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    abortControllerRef.current?.abort()
    setTypewriterJob(null)
    setIsLoading(false)
    answerPendingDisplayRef.current = false
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsAtBottom(true)
    answerPendingDisplayRef.current = false
    setIsLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: userMessage }, { role: 'assistant', content: '' }])
    const assistantIndex = messages.length + 1

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const actions = getRecentActionsForAPI().map(({ type, label, detail, path }) => ({
        type,
        label,
        ...(detail && { detail }),
        ...(path && { path })
      }))
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          recentActions: actions,
          hesitationHint: getHesitationHint(),
          userName: displayName || undefined
        }),
        signal: controller.signal
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        let errorMessage = data?.error || '일시적인 오류가 발생했습니다.'
        if (response.status === 401) errorMessage = '로그인이 만료되었습니다. 다시 로그인해주세요.'
        else if (response.status === 400) errorMessage = '메시지를 입력해주세요.'
        else if (response.status === 500) errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        throw new Error(errorMessage)
      }

      const answer = String(data.answer ?? '')
      const papers = normalizePapers(data.papers)

      setMessages(prev => {
        const next = [...prev]
        if (next[assistantIndex]?.role === 'assistant') {
          next[assistantIndex] = { ...next[assistantIndex], papers: papers.length > 0 ? papers : undefined }
        }
        return next
      })

      if (answer.length > 0) {
        answerPendingDisplayRef.current = true
        setTypewriterJob({ fullText: answer, assistantIndex })
      } else {
        setMessages(prev => {
          const next = [...prev]
          if (next[assistantIndex]?.role === 'assistant') next[assistantIndex] = { ...next[assistantIndex], content: '' }
          return next
        })
      }
      if (isAtBottomRef.current) scrollToBottom('auto')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setMessages(prev => {
          const next = [...prev]
          if (next[assistantIndex]?.role === 'assistant' && !next[assistantIndex].content) {
            next[assistantIndex] = { ...next[assistantIndex], content: '응답이 중단되었습니다.' }
          }
          return next
        })
        return
      }
      console.error('❌ [Chat] 에러:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setMessages(prev => {
        const next = [...prev]
        if (next[assistantIndex]?.role === 'assistant') next[assistantIndex] = { ...next[assistantIndex], content: `죄송합니다. ${errorMessage}\n다시 시도해주세요. 🙏` }
        return next
      })
    } finally {
      abortControllerRef.current = null
      if (!answerPendingDisplayRef.current) setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row">
      <header className="md:hidden bg-white border-b border-gray-100 p-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-[#2DD4BF] transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-gray-900 font-bold text-lg">닥터 도슨 AI</h1>
            <p className="text-gray-400 text-sm">건강 상담 챗봇</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="hidden md:flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-100">
          <Link href="/dashboard" className="text-gray-400 hover:text-[#2DD4BF] transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-gray-900 font-bold text-lg">닥터 도슨 AI</h1>
          <p className="text-gray-500 text-sm">건강 상담 챗봇</p>
        </div>
      <div
        ref={chatScrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-gray-50"
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((message, index) => {
            const isLastAssistant = message.role === 'assistant' && index === messages.length - 1
            const isWaitingFirstToken = isLastAssistant && typewriterJob !== null && typewriterJob.assistantIndex === index && !message.content
            const isStreaming = isLastAssistant && (isLoading || isWaitingFirstToken)
            const lines = message.content ? message.content.split('\n') : []
            return (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-[#2DD4BF] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-[#2DD4BF] text-white'
                      : 'bg-white text-gray-800 border border-gray-100 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {lines.length > 0 ? (
                      <>
                        {lines.map((line, li) => {
                          const isLastLine = li === lines.length - 1
                          return (
                            <motion.span
                              key={li}
                              className="block"
                              initial={isLastLine ? { opacity: 0, y: 8 } : false}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, ease: 'easeOut' }}
                            >
                              {line}
                              {li < lines.length - 1 ? '\n' : null}
                            </motion.span>
                          )
                        })}
                      </>
                    ) : isStreaming ? (
                      <span className="flex flex-col gap-3">
                        <span className="flex items-center gap-1.5" aria-hidden="true">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="w-2 h-2 rounded-full bg-[#2DD4BF] animate-chat-dot-pulse opacity-100"
                              style={{ animationDelay: `${i * 150}ms` }}
                            />
                          ))}
                        </span>
                        <span className="text-gray-500 text-xs">{LOADING_MESSAGE}</span>
                      </span>
                    ) : (
                      message.content
                    )}
                    {isStreaming && lines.length > 0 && (
                      <span className="inline-block w-2 h-4 ml-0.5 bg-[#2DD4BF] animate-pulse align-middle" />
                    )}
                  </p>
                  {message.role === 'assistant' && message.papers && message.papers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">🔗 닥터 도슨이 참고한 연구 논문</p>
                      <ul className="space-y-1.5">
                        {message.papers.map((ref, i) => {
                          const href = ref.url || (ref.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/` : null)
                          return (
                            <li key={i} className="text-xs">
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#2DD4BF] hover:underline flex items-start gap-1.5"
                                >
                                  <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                  <span>{ref.title}</span>
                                </a>
                              ) : (
                                <span className="text-gray-600">{ref.title}</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                  {message.role === 'assistant' && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <MedicalDisclaimer variant="compact" />
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                )}
              </div>
            )
          })}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-[#2DD4BF] flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
                <span className="flex flex-col gap-3">
                  <span className="flex items-center gap-1.5" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-[#2DD4BF] animate-chat-dot-pulse opacity-100"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                  <span className="text-gray-500 text-xs">{LOADING_MESSAGE}</span>
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

        <div className="bg-white border-t border-gray-100 p-4">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="건강에 관해 궁금한 점을 물어보세요..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
            disabled={isStreaming}
          />
          <motion.button
            type={isStreaming ? 'button' : 'submit'}
            disabled={!isStreaming && !input.trim()}
            onClick={isStreaming ? handleStop : undefined}
            className={`relative flex items-center justify-center w-[52px] h-[52px] rounded-xl text-white transition-colors duration-200 ${
              isStreaming
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-[#2DD4BF] hover:bg-[#26b8a5] disabled:bg-gray-200 disabled:cursor-not-allowed'
            }`}
            initial={false}
            aria-label={isStreaming ? '답변 중지' : '전송'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isStreaming ? (
                <motion.span
                  key="stop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Square className="w-5 h-5 fill-current" strokeWidth={2} />
                </motion.span>
              ) : (
                <motion.span
                  key="send"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Send className="w-5 h-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </form>
        </div>
      </div>
    </div>
  )
}
