'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import MedicalDisclaimer from '@/app/components/MedicalDisclaimer'
import ReferencesSidebar, { type Reference } from './ReferencesSidebar'
import { isAnalysisIntent, isForcedSearchTrigger } from '@/lib/medical-papers/intent'
import { useAppContextStore } from '@/store/useAppContextStore'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatInterfaceProps {
  userName: string
}

const SCROLL_BOTTOM_THRESHOLD = 120

export default function ChatInterface({ userName }: ChatInterfaceProps) {
  const getRecentActionsForAPI = useAppContextStore((s) => s.getRecentActionsForAPI)
  const getHesitationHint = useAppContextStore((s) => s.getHesitationHint)
  const [sidebarPapers, setSidebarPapers] = useState<Reference[]>([])
  const [referencesLoading, setReferencesLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [papersArrivedAlert, setPapersArrivedAlert] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `안녕하세요, ${userName}님! 👋\n닥터 도슨 AI 건강 상담사입니다.\n건강에 관한 궁금한 점을 물어보세요.`
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userScrolledUpRef = useRef(false)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  const isNearBottom = useCallback(() => {
    const el = chatScrollRef.current
    if (!el) return true
    const { scrollTop, scrollHeight, clientHeight } = el
    return scrollHeight - scrollTop - clientHeight < SCROLL_BOTTOM_THRESHOLD
  }, [])

  useEffect(() => {
    if (!isLoading) return
    if (!userScrolledUpRef.current) scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  useEffect(() => {
    if (!papersArrivedAlert) return
    const t = setTimeout(() => setPapersArrivedAlert(false), 4000)
    return () => clearTimeout(t)
  }, [papersArrivedAlert])

  const handleScroll = useCallback(() => {
    const el = chatScrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight > SCROLL_BOTTOM_THRESHOLD) {
      userScrolledUpRef.current = true
    } else {
      userScrolledUpRef.current = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    userScrolledUpRef.current = false
    setIsLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: userMessage }, { role: 'assistant', content: '' }])
    const assistantIndex = messages.length + 1

    const isAnalysisMode = isAnalysisIntent(userMessage)
    const forceSearch = isForcedSearchTrigger(userMessage)
    const shouldFetchPapers = isAnalysisMode || forceSearch
    if (shouldFetchPapers) {
      setReferencesLoading(true)
      setSidebarPapers([])
    } else {
      setReferencesLoading(false)
      setSidebarPapers([])
    }

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
          recentActions: actions,
          hesitationHint: getHesitationHint()
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        let errorMessage = data?.error || '일시적인 오류가 발생했습니다.'
        if (response.status === 401) errorMessage = '로그인이 만료되었습니다. 다시 로그인해주세요.'
        else if (response.status === 400) errorMessage = '메시지를 입력해주세요.'
        else if (response.status === 500) errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        throw new Error(errorMessage)
      }

      const answer = data.answer ?? ''
      const papers = Array.isArray(data.papers) ? data.papers : []
      setMessages(prev => {
        const next = [...prev]
        if (next[assistantIndex]?.role === 'assistant') {
          next[assistantIndex] = { ...next[assistantIndex], content: answer }
        }
        return next
      })
      setReferencesLoading(false)
      setSidebarPapers(papers)
      if (papers.length > 0) {
        setSidebarOpen(true)
        setPapersArrivedAlert(true)
      }
      scrollToBottom('auto')
    } catch (error) {
      console.error('❌ [Chat] 에러:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setMessages(prev => {
        const next = [...prev]
        if (next[assistantIndex]?.role === 'assistant') next[assistantIndex] = { ...next[assistantIndex], content: `죄송합니다. ${errorMessage}\n다시 시도해주세요. 🙏` }
        return next
      })
    } finally {
      setIsLoading(false)
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
            const isStreaming = isLastAssistant && isLoading
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
                    ) : (
                      message.content
                    )}
                    {isStreaming && (
                      <span className="inline-block w-2 h-4 ml-0.5 bg-[#2DD4BF] animate-pulse align-middle" />
                    )}
                  </p>
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
              <div className="w-8 h-8 rounded-full bg-[#2DD4BF] flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-[#2DD4BF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#2DD4BF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#2DD4BF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
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
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-[#2DD4BF] hover:bg-[#26b8a5] disabled:bg-gray-200 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        </div>
      </div>

      {/* 논문 도착 알림 */}
      {papersArrivedAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#2DD4BF] text-white text-sm font-medium rounded-full shadow-lg flex items-center gap-2">
          <FileText className="w-4 h-4 flex-shrink-0" />
          새로운 근거가 도착했습니다
        </div>
      )}

      {/* 데스크톱: md 이상에서 우측 사이드바 (sidebarPapers 구독) */}
      {(sidebarPapers.length > 0 || referencesLoading) && (
        <div className="hidden md:flex flex-shrink-0">
          <ReferencesSidebar references={sidebarPapers} isLoading={referencesLoading} />
        </div>
      )}

      {/* 모바일: 참고 논문 버튼 + 열면 보이는 사이드바 패널 */}
      {(sidebarPapers.length > 0 || referencesLoading) && (
        <div className="md:hidden fixed bottom-20 right-4 z-30">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="flex items-center gap-2 bg-[#2DD4BF] text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-[#26b8a5] transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>참고 논문 {sidebarPapers.length > 0 ? `(${sidebarPapers.length})` : ''}</span>
          </button>
        </div>
      )}
      {sidebarOpen && (sidebarPapers.length > 0 || referencesLoading) && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40"
            aria-hidden
            onClick={() => setSidebarOpen(false)}
          />
          <div className="md:hidden fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-xl z-50 flex flex-col transition-transform duration-200 ease-out">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">참고 논문</h2>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ReferencesSidebar references={sidebarPapers} isLoading={referencesLoading} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
