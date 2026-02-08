'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import MedicalDisclaimer from '@/app/components/MedicalDisclaimer'
import ReferencesSidebar, { type Reference } from './ReferencesSidebar'
import { isAnalysisIntent } from '@/lib/medical-papers/intent'
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
  const [references, setReferences] = useState<Reference[]>([])
  const [referencesLoading, setReferencesLoading] = useState(false)
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
    if (isAnalysisMode) {
      setReferencesLoading(true)
      setReferences([])
      fetch(`/api/medical-papers/search?query=${encodeURIComponent(userMessage)}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (data?.success && Array.isArray(data.references)) {
            setReferences(data.references)
          }
        })
        .catch(() => {})
        .finally(() => setReferencesLoading(false))
    } else {
      setReferencesLoading(false)
      setReferences([])
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        let errorMessage = '일시적인 오류가 발생했습니다.'
        if (response.status === 401) errorMessage = '로그인이 만료되었습니다. 다시 로그인해주세요.'
        else if (response.status === 400) errorMessage = '메시지를 입력해주세요.'
        else if (response.status === 500) errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        throw new Error(errorData?.error || errorMessage)
      }

      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await response.json()
        if (data.error) throw new Error(data.error)
        if (data.reply) {
          setMessages(prev => {
            const next = [...prev]
            if (next[assistantIndex]?.role === 'assistant') next[assistantIndex] = { ...next[assistantIndex], content: data.reply }
            return next
          })
        }
        setIsLoading(false)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) {
        setIsLoading(false)
        throw new Error('스트림을 읽을 수 없습니다.')
      }

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const next = [...prev]
          if (next[assistantIndex]?.role === 'assistant') next[assistantIndex] = { ...next[assistantIndex], content: accumulated }
          return next
        })
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
      if (isAnalysisMode) setReferencesLoading(false)
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

      {(references.length > 0 || referencesLoading) && (
        <div className="hidden lg:flex">
          <ReferencesSidebar references={references} isLoading={referencesLoading} />
        </div>
      )}
    </div>
  )
}
