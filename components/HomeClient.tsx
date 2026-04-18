'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import ChatWindow from '@/components/ChatWindow'
import PersonaModal from '@/components/PersonaModal'
import MemoryManager from '@/components/MemoryManager'
import PersonaSwitcher from '@/components/PersonaSwitcher'
import ChatHistoryPanel from '@/components/ChatHistoryPanel'
import VoiceCallOverlay from '@/components/VoiceCallOverlay'
import SettingsPanel from '@/components/SettingsPanel'
import type { ChatSessionDetail, ChatSessionSummary, Message, Persona, ReplyLanguage } from '@/types'
import { apiUrl } from '@/lib/api-url'
import { useI18n } from '@/lib/i18n/context'
import { localizePersona } from '@/lib/persona-localization'

type Modal = 'persona' | 'memory' | 'switcher' | 'settings' | null

function getDefaultPersona(locale: 'zh' | 'en'): Persona {
  return locale === 'zh'
    ? {
        id: 'default',
        name: '晓雨',
        avatar: '*',
        reply_style: 'medium',
        prompt: '你是晓雨，一个温柔、共情、善于倾听的 AI 伴侣。',
      }
    : {
        id: 'default',
        name: 'Xiaoyu',
        avatar: '*',
        reply_style: 'medium',
        prompt: 'You are Xiaoyu, a warm and empathetic companion.',
      }
}

function deriveSessionTitle(text: string, fallback: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return fallback
  return compact.length > 24 ? `${compact.slice(0, 24)}...` : compact
}

export default function HomeClient() {
  const { locale, t } = useI18n()
  const defaultPersona = useMemo(() => getDefaultPersona(locale), [locale])

  const [persona, setPersona] = useState<Persona | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [modal, setModal] = useState<Modal>(null)
  const [loading, setLoading] = useState(true)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>(locale)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [voiceCallOpen, setVoiceCallOpen] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [currentSessionType, setCurrentSessionType] = useState<'text' | 'voice' | null>(null)

  useEffect(() => {
    setReplyLanguage(locale)
  }, [locale])

  useEffect(() => {
    fetch(apiUrl('/api/personas/active'))
      .then(r => {
        if (!r.ok) throw new Error('load failed')
        return r.json() as Promise<Persona>
      })
      .then(data => {
        setPersona(data?.id ? data : defaultPersona)
        setLoading(false)
      })
      .catch(() => {
        setPersona(defaultPersona)
        setLoading(false)
      })
  }, [defaultPersona])

  const activePersona = persona ?? defaultPersona
  const displayPersona = localizePersona(activePersona, locale) ?? activePersona

  function resetConversation() {
    setMessages([])
    setCurrentSessionId(null)
    setCurrentSessionType(null)
  }

  const handlePersonaSwitch = (newPersona: Persona) => {
    setPersona(newPersona)
    resetConversation()
    setModal(null)
    setHistoryRefreshKey(k => k + 1)
  }

  async function createSession(seedText: string, sessionType: 'text' | 'voice' = 'text'): Promise<string | null> {
    try {
      const res = await fetch(apiUrl('/api/history'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: deriveSessionTitle(seedText, t('app.newConversationTitle')),
          persona_id: activePersona.id,
          session_type: sessionType,
        }),
      })
      if (!res.ok) throw new Error('create session failed')
      const session = (await res.json()) as ChatSessionSummary
      if (!session?.id) throw new Error('invalid session')
      setCurrentSessionId(session.id)
      setCurrentSessionType(sessionType)
      setHistoryRefreshKey(k => k + 1)
      return session.id
    } catch {
      return null
    }
  }

  async function ensureSession(seedText: string, sessionType: 'text' | 'voice' = 'text'): Promise<string | null> {
    if (currentSessionId && currentSessionType === sessionType) return currentSessionId
    return createSession(seedText, sessionType)
  }

  async function maybeSwitchPersonaForSession(detail: ChatSessionDetail) {
    if (!detail.persona_id || detail.persona_id === activePersona.id) return
    try {
      const listRes = await fetch(apiUrl('/api/personas'))
      if (!listRes.ok) return
      const personas = (await listRes.json()) as Persona[]
      const matched = personas.find(item => item.id === detail.persona_id)
      if (!matched) return
      setPersona(matched)
      await fetch(apiUrl('/api/personas/active'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: matched.id }),
      })
    } catch {
      // ignore persona switch failures when loading history
    }
  }

  async function loadSession(sessionId: string) {
    try {
      const res = await fetch(apiUrl(`/api/history/${sessionId}`))
      if (!res.ok) throw new Error('load session failed')
      const detail = (await res.json()) as ChatSessionDetail
      await maybeSwitchPersonaForSession(detail)
      setCurrentSessionId(detail.id)
      setCurrentSessionType(detail.session_type)
      setMessages(detail.messages || [])
      setHistoryOpen(false)
    } catch {
      // ignore load failures to avoid nuking current conversation
    }
  }

  const handleSendMessage = async (
    text: string,
    imageUrl?: string,
    imagePreviewUrl?: string,
    lang: ReplyLanguage = replyLanguage,
    sessionType: 'text' | 'voice' = 'text',
  ): Promise<string | null> => {
    if (!text && !imageUrl) return null

    const sessionId = await ensureSession(text || t('app.imageChatSeed'), sessionType)

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      content_type: imageUrl ? 'image' : 'text',
      image_url: imageUrl,
      image_preview: imagePreviewUrl,
      session_id: sessionId ?? undefined,
      created_at: new Date().toISOString(),
    }

    const typingId = `typing-${Date.now()}`
    const typingMsg: Message = {
      id: typingId,
      role: 'assistant',
      content: '',
      content_type: 'text',
      is_typing: true,
      session_id: sessionId ?? undefined,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg, typingMsg])

    try {
      const res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          imageUrl,
          replyLanguage: lang,
          session_id: sessionId,
          voice_mode: sessionType === 'voice',
        }),
      })

      if (!res.ok) throw new Error('API error')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream body')

      const decoder = new TextDecoder()
      let aiContent = ''
      let started = false
      let finished = false
      let lineBuffer = ''
      let streamError = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuffer += decoder.decode(value)
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6)) as { text?: string; error?: string; done?: boolean }
            if (data.text) {
              aiContent += data.text
              if (!started) {
                started = true
                setMessages(prev =>
                  prev.map(m => (m.id === typingId ? { ...m, is_typing: false, content: aiContent } : m)),
                )
              } else {
                setMessages(prev => prev.map(m => (m.id === typingId ? { ...m, content: aiContent } : m)))
              }
            }
            if (data.error) streamError = String(data.error)
            if (data.done) {
              finished = true
              const finalText = aiContent || t('app.noReply')
              setMessages(prev =>
                prev.map(m =>
                  m.id === typingId
                    ? {
                        ...m,
                        id: `ai-${Date.now()}`,
                        is_typing: false,
                        content: finalText,
                        session_id: sessionId ?? undefined,
                      }
                    : m,
                ),
              )
              setCurrentSessionType(sessionType)
              setHistoryRefreshKey(k => k + 1)
              return finalText
            }
          } catch {
            // ignore invalid chunks
          }
        }
      }

      if (!finished) {
        setMessages(prev =>
          prev.map(m =>
            m.id === typingId
              ? {
                  ...m,
                  is_typing: false,
                  id: `err-${Date.now()}`,
                  content: streamError ? t('app.requestFailed', { error: streamError }) : t('app.noReply'),
                }
              : m,
          ),
        )
      }
      setHistoryRefreshKey(k => k + 1)
      return null
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === typingId
            ? { ...m, is_typing: false, id: `err-${Date.now()}`, content: t('app.somethingWentWrong') }
            : m,
        ),
      )
      setHistoryRefreshKey(k => k + 1)
      return null
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm animate-pulse">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        persona={displayPersona}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onOpenSettings={() => setModal('settings')}
        onEditPersona={() => setModal('persona')}
        onOpenMemory={() => setModal('memory')}
        onSwitchPersona={() => setModal('switcher')}
        onOpenHistory={() => setHistoryOpen(true)}
        onStartVoiceCall={() => setVoiceCallOpen(true)}
        onNewChat={resetConversation}
      />

      <ChatHistoryPanel
        isOpen={historyOpen}
        currentSessionId={currentSessionId}
        refreshKey={historyRefreshKey}
        onClose={() => setHistoryOpen(false)}
        onSelectSession={loadSession}
        onDeletedSession={sessionId => {
          if (sessionId === currentSessionId) resetConversation()
          setHistoryRefreshKey(k => k + 1)
        }}
      />

      <ChatWindow
        persona={displayPersona}
        messages={messages}
        onSendMessage={handleSendMessage}
        onStartVoiceCall={() => setVoiceCallOpen(true)}
        voiceCallOpen={voiceCallOpen}
      />

      {modal === 'settings' && (
        <SettingsPanel
          onClose={() => setModal(null)}
          onEditPersona={() => setModal('persona')}
          onOpenMemory={() => setModal('memory')}
          onSwitchPersona={() => setModal('switcher')}
        />
      )}

      {modal === 'persona' && (
        <PersonaModal
          persona={activePersona}
          onSave={p => {
            setPersona(p)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'memory' && <MemoryManager onClose={() => setModal(null)} />}

      {modal === 'switcher' && (
        <PersonaSwitcher currentPersona={activePersona} onSwitch={handlePersonaSwitch} onClose={() => setModal(null)} />
      )}

      {voiceCallOpen && (
        <VoiceCallOverlay
          persona={displayPersona}
          isOpen={voiceCallOpen}
          onClose={() => setVoiceCallOpen(false)}
          replyLanguage={replyLanguage}
          onVoiceTurn={(text, lang, sessionType) => handleSendMessage(text, undefined, undefined, lang, sessionType ?? 'voice')}
        />
      )}
    </div>
  )
}
