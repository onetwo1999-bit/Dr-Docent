'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import MedicalDisclaimer from '@/app/components/MedicalDisclaimer'
import { useAppContextStore } from '@/store/useAppContextStore'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatInterfaceProps {
  userName: string
}

const MIN_THINKING_MS = 3000
const MIN_THINKING_LONG_MS = 5000
const LONG_REPLY_LENGTH = 200
const TYPEWRITER_INTERVAL_MS = 48

export default function ChatInterface({ userName }: ChatInterfaceProps) {
  const getRecentActionsForAPI = useAppContextStore((s) => s.getRecentActionsForAPI)
  const getHesitationHint = useAppContextStore((s) => s.getHesitationHint)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `안녕하세요, ${userName}님! 👋\n닥터 도슨 AI 건강 상담사입니다.\n건강에 관한 궁금한 점을 물어보세요.`
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingTypewriterContent, setPendingTypewriterContent] = useState<string | null>(null)
  const [typewriterLength, setTypewriterLength] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const thinkingStartedAtRef = useRef<number>(0)

  // 메시지가 추가될 때마다 스크롤 (타이핑 중에도 부드럽게)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typewriterLength])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    
    // 유저 메시지 추가
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)
    thinkingStartedAtRef.current = Date.now()

    try {
      console.log('🔄 [Chat] API 요청 시작:', userMessage)
      
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

      console.log('📡 [Chat] 응답 상태:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ [Chat] API 에러:', response.status, errorData)
        let errorMessage = '일시적인 오류가 발생했습니다.'
        if (response.status === 401) errorMessage = '로그인이 만료되었습니다. 다시 로그인해주세요.'
        else if (response.status === 400) errorMessage = '메시지를 입력해주세요.'
        else if (response.status === 500) errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('✅ [Chat] 응답 수신 완료')
      
      const reply = data.reply
      if (!reply) throw new Error('응답 데이터가 없습니다.')

      const minThinkingMs = reply.length > LONG_REPLY_LENGTH ? MIN_THINKING_LONG_MS : MIN_THINKING_MS
      const elapsed = Date.now() - thinkingStartedAtRef.current
      const waitMs = Math.max(0, minThinkingMs - elapsed)

      const applyReply = () => {
        setIsLoading(false)
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
        setPendingTypewriterContent(reply)
        setTypewriterLength(0)
      }

      if (waitMs > 0) {
        setTimeout(applyReply, waitMs)
      } else {
        applyReply()
      }
      
    } catch (error) {
      console.error('❌ [Chat] 에러:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setIsLoading(false)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `죄송합니다. ${errorMessage}\n다시 시도해주세요. 🙏`
      }])
    }
  }

  // 한 글자씩 타이핑 효과
  useEffect(() => {
    if (pendingTypewriterContent == null || typewriterLength >= pendingTypewriterContent.length) {
      if (pendingTypewriterContent != null && typewriterLength >= pendingTypewriterContent.length) {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: pendingTypewriterContent }
          return next
        })
        setPendingTypewriterContent(null)
      }
      return
    }
    const t = setTimeout(() => setTypewriterLength(prev => prev + 1), TYPEWRITER_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [pendingTypewriterContent, typewriterLength])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 p-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link 
            href="/dashboard" 
            className="text-gray-400 hover:text-[#2DD4BF] transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-gray-900 font-bold text-lg">닥터 도슨 AI</h1>
            <p className="text-gray-400 text-sm">건강 상담 챗봇</p>
          </div>
        </div>
      </header>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((message, index) => {
            const isLastAssistant = message.role === 'assistant' && index === messages.length - 1
            const displayContent = isLastAssistant && pendingTypewriterContent != null
              ? pendingTypewriterContent.slice(0, typewriterLength)
              : message.content
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
                  {displayContent}
                  {isLastAssistant && pendingTypewriterContent != null && typewriterLength < pendingTypewriterContent.length && (
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
          )})}
          
          {/* 로딩 인디케이터 */}
          {isLoading && (
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

      {/* 입력 영역 */}
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
  )
}
