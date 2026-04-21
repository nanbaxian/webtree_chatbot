'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, CircleUserRound, Loader2, Menu, Plus, Quote, SendHorizontal } from 'lucide-react'
import { apiUrl } from '@/lib/api-url'
import { parseRagCitationsHeader, type RagCitation } from '@/lib/rag-protocol'

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  isTyping?: boolean
}

function getTenantId(): string {
  if (typeof window === 'undefined') return 'tenant_demo'
  const params = new URLSearchParams(window.location.search)
  return params.get('tenant_id') || window.localStorage.getItem('knowledgeos_tenant_id') || 'tenant_demo'
}

function citationLabel(citation: RagCitation, index: number): string {
  const label = citation.source_label || citation.title || `Source ${index + 1}`
  const location = [citation.section, citation.page_num ? `Page ${citation.page_num}` : null].filter(Boolean).join(' | ')
  return location ? `${label} | ${location}` : label
}

export default function KnowledgeChatDemo({ botId }: { botId: string }) {
  const [tenantId, setTenantId] = useState('tenant_demo')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Ask a question. I will stream the answer here and keep source hints on the side.',
    },
  ])
  const [input, setInput] = useState('How does source citation work?')
  const [isSending, setIsSending] = useState(false)
  const [citations, setCitations] = useState<RagCitation[]>([
    {
      title: 'Knowledge base',
      source_label: 'Refund policy',
      section: 'Page 12',
      excerpt: 'This answer was grounded in the refund policy and the latest service terms.',
    },
    {
      title: 'Product manual',
      source_label: 'Setup guide',
      section: 'Section 3',
      excerpt: 'The retrieval layer also surfaced the installation steps from the product manual.',
    },
  ])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTenantId(getTenantId())
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

  const recentSources = useMemo(() => citations.slice(0, 2), [citations])
  const showEmptyState = messages.length === 1 && messages[0]?.id === 'welcome'

  async function sendMessage() {
    const text = input.trim()
    if (!text || isSending) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    const typingId = `typing-${Date.now()}`
    const typingMessage: ChatMessage = {
      id: typingId,
      role: 'assistant',
      content: '',
      isTyping: true,
    }

    setMessages(prev => [...prev, userMessage, typingMessage])
    setInput('')
    setIsSending(true)

    try {
      const res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          bot_id: botId,
          message: text,
          replyLanguage: 'en',
        }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const parsedCitations = parseRagCitationsHeader(res.headers.get('X-KnowledgeOS-Citations'))
      if (parsedCitations.length > 0) {
        setCitations(parsedCitations)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream body')

      const decoder = new TextDecoder()
      let buffer = ''
      let content = ''
      let finished = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const payload = JSON.parse(line.slice(6)) as { text?: string; done?: boolean; error?: string }
            if (payload.text) {
              content += payload.text
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === typingId
                    ? { ...msg, content, isTyping: false }
                    : msg,
                ),
              )
            }
            if (payload.done) {
              finished = true
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === typingId
                    ? { ...msg, id: `assistant-${Date.now()}`, content: content || 'No response returned.', isTyping: false }
                    : msg,
                ),
              )
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }

      if (!finished) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === typingId
              ? { ...msg, id: `assistant-${Date.now()}`, content: content || 'No response returned.', isTyping: false }
              : msg,
          ),
        )
      }
    } catch (error) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === typingId
            ? {
                ...msg,
                id: `error-${Date.now()}`,
                content: error instanceof Error ? error.message : 'Request failed.',
                isTyping: false,
              }
            : msg,
        ),
      )
    } finally {
      setIsSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <main className="min-h-[100dvh] bg-white text-slate-950 lg:min-h-screen lg:bg-[#0b0e13] lg:px-6 lg:py-6 lg:text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1920px] gap-0 lg:h-[calc(100vh-3rem)] lg:gap-5">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-white shadow-none lg:rounded-[2rem] lg:border lg:border-white/10 lg:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] lg:backdrop-blur-xl">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              aria-label="Open menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-slate-950"
            >
              <span className="truncate">Webtree Academy AI</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="New chat"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
              >
                <Plus className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                aria-label="Profile"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
              >
                <CircleUserRound className="h-4.5 w-4.5" />
              </button>
            </div>
          </header>

          <header className="hidden items-center justify-between gap-3 border-b border-white/10 px-5 py-4 lg:flex lg:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-white lg:text-2xl">Webtree Academy AI</h1>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
              RAG
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5 text-slate-950 lg:px-6 lg:text-white">
            {showEmptyState ? (
              <div className="flex min-h-[48vh] flex-col items-center justify-center px-6 pb-8 text-center lg:hidden">
                <div className="text-[2rem] font-medium leading-tight tracking-[-0.03em] text-slate-950">
                  What can I help with today?
                </div>
                <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
                  Ask about courses, admissions, timetable, or contact details.
                </p>
              </div>
            ) : null}
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`max-w-[92%] rounded-[1.5rem] px-4 py-4 text-sm leading-7 lg:text-[15px] ${
                    message.role === 'user'
                      ? 'ml-auto rounded-br-md border border-amber-300/20 bg-amber-300 text-slate-950'
                      : message.id === 'welcome'
                        ? 'hidden rounded-bl-md border border-white/10 bg-white/6 text-slate-700 lg:block lg:text-white/80'
                        : 'rounded-bl-md border border-slate-200 bg-slate-50 text-slate-800 lg:border-white/10 lg:bg-white/6 lg:text-white/80'
                  }`}
                >
                  {message.isTyping ? (
                    <span className="inline-flex items-center gap-2 text-slate-500 lg:text-white/65">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking
                    </span>
                  ) : (
                    message.content
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur lg:static lg:border-t-white/10 lg:bg-transparent lg:px-4 lg:py-4">
            <div className="mx-auto w-full max-w-5xl rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)] lg:border-white/10 lg:bg-slate-950/65 lg:p-4 lg:shadow-2xl lg:shadow-black/20">
              <label className="text-xs uppercase tracking-[0.26em] text-slate-400 lg:text-white/45">Ask a question</label>
              <div className="mt-3 flex items-end gap-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Type your question..."
                  className="min-h-[56px] max-h-[180px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 lg:border-white/10 lg:bg-white/5 lg:text-white lg:placeholder:text-white/35 lg:focus:border-amber-200/40 lg:focus:ring-amber-200/15"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={isSending || !input.trim()}
                  className="inline-flex h-14 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 lg:bg-white lg:text-slate-950 lg:hover:bg-amber-100"
                >
                  {isSending ? 'Sending' : 'Send'}
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 hidden flex-wrap gap-2 text-xs text-slate-500 lg:flex lg:text-white/45">
                <button
                  onClick={() => setInput('What sources were used to answer the last question?')}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
                >
                  Explain citations
                </button>
                <button
                  onClick={() => setInput('Summarize the answer in one sentence.')}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
                >
                  Short answer
                </button>
                <button
                  onClick={() => setInput('What should I ask next?')}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
                >
                  Follow-up prompt
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="hidden w-[300px] shrink-0 flex-col gap-4 xl:flex">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-xs uppercase tracking-[0.28em] text-amber-100/80">Sources</div>
            <div className="mt-4 space-y-3">
              {recentSources.map((item, index) => (
                <article key={`${item.id || item.chunk_id || index}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-start gap-2 text-sm font-medium text-white">
                    <Quote className="mt-0.5 h-4 w-4 text-amber-100" />
                    <span>{citationLabel(item, index)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/65">{item.excerpt || 'Retrieved source excerpt will appear here.'}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm text-emerald-100 backdrop-blur-xl">
            <CheckCircle2 className="mb-2 h-4 w-4" />
            This layout keeps the conversation area dominant and pushes supporting material into a slim side rail.
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-white/60 backdrop-blur-xl">
            bot/{botId}
            <div className="mt-2 text-xs uppercase tracking-[0.22em] text-white/40">Tenant</div>
            <div className="mt-1 text-white/80">{tenantId}</div>
            <div className="mt-4 text-xs uppercase tracking-[0.22em] text-white/40">Mode</div>
            <div className="mt-1 text-white/80">Chat-first demo</div>
          </div>
        </aside>
      </div>
    </main>
  )
}
