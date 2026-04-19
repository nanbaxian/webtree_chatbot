'use client'

import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Message, Persona } from '@/types'
import { useI18n } from '@/lib/i18n/context'

interface Props {
  message: Message
  persona: Persona | null
  isFirst: boolean
}

export default function MessageBubble({ message, persona, isFirst }: Props) {
  const { t } = useI18n()
  const isAI = message.role === 'assistant'
  const isUser = message.role === 'user'
  const time = new Date(message.created_at)
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 items-end ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm
          ${
            isAI
              ? 'bg-primary/15 border border-primary/25 shadow-[0_0_10px_hsl(var(--glow-primary)/0.2)]'
              : 'bg-secondary text-muted-foreground'
          }
          ${!isFirst ? 'invisible' : ''}
        `}
      >
        {isAI ? (persona?.avatar || '*') : '👤'}
      </div>

      <div className={`max-w-[70%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {message.content_type === 'image' && (message.image_preview || message.image_url) && (
          <div className="rounded-2xl overflow-hidden border border-border max-w-[280px]">
            <img src={message.image_preview || message.image_url} alt={t('chat.imagePreviewAlt')} className="w-full block" loading="lazy" />
          </div>
        )}

        {(message.content || message.is_typing) && (
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
              ${
                isAI
                  ? 'bg-bubble-ai border border-border text-foreground rounded-bl-md'
                  : 'bg-bubble-user text-bubble-user-foreground rounded-br-md'
              }
            `}
          >
            {message.is_typing ? (
              <TypingDots />
            ) : isAI ? (
              <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            ) : (
              <span className="whitespace-pre-wrap break-words">{message.content}</span>
            )}
          </div>
        )}

        {isAI && message.citations && message.citations.length > 0 && (
          <div className="mt-2 w-full space-y-2">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">Sources</div>
            {message.citations.map((citation, index) => (
              <article
                key={citation.id || citation.chunk_id || citation.qa_pair_id || `${index}`}
                className="rounded-2xl border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {citation.source_label || citation.title || `Source ${index + 1}`}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
                      {citation.section ? <span>{citation.section}</span> : null}
                      {typeof citation.page_num === 'number' ? <span>Page {citation.page_num}</span> : null}
                      {typeof citation.score === 'number' ? <span>Score {citation.score.toFixed(2)}</span> : null}
                    </div>
                  </div>
                  {citation.source_url ? (
                    <a
                      href={citation.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-background"
                    >
                      Open
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                {citation.excerpt ? <p className="mt-2 leading-5 text-muted-foreground">{citation.excerpt}</p> : null}
              </article>
            ))}
          </div>
        )}

        {!message.is_typing && <span className="text-[11px] text-muted-foreground px-1">{timeStr}</span>}
      </div>
    </motion.div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-1.5 py-1 px-1 items-center">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-typing-dot animate-typing-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  )
}
