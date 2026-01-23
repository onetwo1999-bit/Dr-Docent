'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatInterfaceProps {
  userName: string
}

export default function ChatInterface({ userName }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `안녕하세요, ${userName}님! 👋\n닥터 도슨 AI 건강 상담사입니다.\n건강에 관한 궁금한 점을 물어보세요.`
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 메시지가 추가될 때마다 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    
    // 유저 메시지 추가
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })

      if (!response.ok) throw new Error('API 요청 실패')

      const data = await response.json()
      
      // AI 응답 추가
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (error) {
      console.error('채팅 에러:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.' 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#008080] flex flex-col">
      {/* 헤더 */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link 
            href="/dashboard" 
            className="text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg">닥터 도슨 AI</h1>
            <p className="text-white/60 text-sm">건강 상담 챗봇</p>
          </div>
        </div>
      </header>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-[#40E0D0] flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-[#008080]" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-white text-[#008080]'
                    : 'bg-white/10 text-white'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}
          
          {/* 로딩 인디케이터 */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-[#40E0D0] flex items-center justify-center">
                <Bot className="w-5 h-5 text-[#008080]" />
              </div>
              <div className="bg-white/10 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="bg-white/10 backdrop-blur-md border-t border-white/20 p-4">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="건강에 관해 궁금한 점을 물어보세요..."
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#40E0D0] focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-[#40E0D0] hover:bg-[#3BC9BB] disabled:bg-white/20 disabled:cursor-not-allowed text-[#008080] px-4 py-3 rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
