'use client'

import { motion } from 'framer-motion'
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
