'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X, MessageSquare, Phone, Trash2, Pin, MoreHorizontal, Pencil } from 'lucide-react'
import type { ChatSessionSummary, Persona } from '@/types'
import { apiUrl } from '@/lib/api-url'
import { useI18n } from '@/lib/i18n/context'
import { formatRelativeTime } from '@/lib/i18n/format'
import { localizePersona } from '@/lib/persona-localization'

interface Props {
  isOpen: boolean
  currentSessionId?: string | null
  refreshKey?: number
  onClose: () => void
  onSelectSession: (sessionId: string) => void
  onDeletedSession?: (sessionId: string) => void
}

export default function ChatHistoryPanel({
  isOpen,
  currentSessionId,
  refreshKey = 0,
  onClose,
  onSelectSession,
  onDeletedSession,
}: Props) {
  const { locale, t } = useI18n()
  const [search, setSearch] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(apiUrl('/api/history'))
        if (!res.ok) throw new Error('load history failed')
        const data = (await res.json()) as ChatSessionSummary[]
        if (!cancelled) setSessions(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setSessions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isOpen, refreshKey])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return sessions
    return sessions.filter(
      s =>
        s.title.toLowerCase().includes(keyword) ||
        s.last_message_preview.toLowerCase().includes(keyword) ||
        resolvePersonaName(s, locale).toLowerCase().includes(keyword),
    )
  }, [locale, search, sessions])

  const pinned = filtered.filter(s => s.is_pinned)
  const recent = filtered.filter(s => !s.is_pinned)

  async function togglePin(session: ChatSessionSummary) {
    try {
      const res = await fetch(apiUrl(`/api/history/${session.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !session.is_pinned }),
      })
      if (!res.ok) throw new Error('toggle pin failed')
      const updated = (await res.json()) as ChatSessionSummary
      setSessions(prev => prev.map(item => (item.id === session.id ? updated : item)))
      setActiveMenu(null)
    } catch {
      // keep UI stable on failure
    }
  }

  function beginRename(session: ChatSessionSummary) {
    setRenamingId(session.id)
    setRenameValue(session.title)
    setActiveMenu(null)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function submitRename(sessionId: string) {
    const title = renameValue.trim()
    if (!title) {
      cancelRename()
      return
    }

    try {
      const res = await fetch(apiUrl(`/api/history/${sessionId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) throw new Error('rename failed')
      const updated = (await res.json()) as ChatSessionSummary
      setSessions(prev => prev.map(item => (item.id === sessionId ? updated : item)))
      cancelRename()
    } catch {
      // keep input open on failure
    }
  }

  async function deleteSession(sessionId: string) {
    try {
      const res = await fetch(apiUrl(`/api/history/${sessionId}`), { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setSessions(prev => prev.filter(item => item.id !== sessionId))
      setActiveMenu(null)
      if (renamingId === sessionId) cancelRename()
      onDeletedSession?.(sessionId)
    } catch {
      // keep UI stable on failure
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="fixed lg:relative z-30 w-[320px] h-full flex flex-col bg-sidebar border-r border-sidebar-border"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
            <h2 className="font-serif text-base text-foreground">{t('history.title')}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('history.searchPlaceholder')}
                className="w-full bg-input border border-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-4">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <div className="mb-3">
                    <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Pin className="w-3 h-3" />
                      {t('history.pinned')}
                    </div>
                    {pinned.map(session => (
                      <SessionItem
                        key={session.id}
                        locale={locale}
                        session={session}
                        isActive={session.id === currentSessionId}
                        isMenuOpen={activeMenu === session.id}
                        isRenaming={renamingId === session.id}
                        renameValue={renamingId === session.id ? renameValue : ''}
                        onRenameValueChange={setRenameValue}
                        onCancelRename={cancelRename}
                        onSubmitRename={() => submitRename(session.id)}
                        onToggleMenu={() => setActiveMenu(activeMenu === session.id ? null : session.id)}
                        onBeginRename={() => beginRename(session)}
                        onSelect={() => onSelectSession(session.id)}
                        onTogglePin={() => togglePin(session)}
                        onDelete={() => deleteSession(session.id)}
                      />
                    ))}
                  </div>
                )}

                {recent.length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t('history.recent')}</div>
                    {recent.map(session => (
                      <SessionItem
                        key={session.id}
                        locale={locale}
                        session={session}
                        isActive={session.id === currentSessionId}
                        isMenuOpen={activeMenu === session.id}
                        isRenaming={renamingId === session.id}
                        renameValue={renamingId === session.id ? renameValue : ''}
                        onRenameValueChange={setRenameValue}
                        onCancelRename={cancelRename}
                        onSubmitRename={() => submitRename(session.id)}
                        onToggleMenu={() => setActiveMenu(activeMenu === session.id ? null : session.id)}
                        onBeginRename={() => beginRename(session)}
                        onSelect={() => onSelectSession(session.id)}
                        onTogglePin={() => togglePin(session)}
                        onDelete={() => deleteSession(session.id)}
                      />
                    ))}
                  </div>
                )}

                {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t('history.empty')}</div>}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SessionItem({
  locale,
  session,
  isActive,
  isMenuOpen,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onCancelRename,
  onSubmitRename,
  onToggleMenu,
  onBeginRename,
  onSelect,
  onTogglePin,
  onDelete,
}: {
  locale: 'zh' | 'en'
  session: ChatSessionSummary
  isActive: boolean
  isMenuOpen: boolean
  isRenaming: boolean
  renameValue: string
  onRenameValueChange: (value: string) => void
  onCancelRename: () => void
  onSubmitRename: () => void
  onToggleMenu: () => void
  onBeginRename: () => void
  onSelect: () => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const personaName = resolvePersonaName(session, locale)

  return (
    <div className="relative group">
      <button
        onClick={isRenaming ? undefined : onSelect}
        className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-start gap-3 ${
          isActive ? 'bg-sidebar-accent border border-primary/20' : 'hover:bg-sidebar-accent'
        }`}
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
          {session.persona_avatar || (session.session_type === 'voice' ? '📞' : '💬')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {isRenaming ? (
              <input
                value={renameValue}
                onChange={e => onRenameValueChange(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation()
                  if (e.key === 'Enter') onSubmitRename()
                  if (e.key === 'Escape') onCancelRename()
                }}
                onBlur={onSubmitRename}
                maxLength={60}
                autoFocus
                className="h-8 flex-1 rounded-lg border border-primary/30 bg-input px-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
            ) : (
              <span className="text-sm text-foreground font-medium truncate flex-1">{session.title}</span>
            )}
            {session.session_type === 'voice' && <Phone className="w-3 h-3 text-primary flex-shrink-0" />}
          </div>
          {personaName && <p className="text-[11px] text-muted-foreground truncate mb-1">{personaName}</p>}
          <p className="text-xs text-muted-foreground truncate">{session.last_message_preview || t('history.emptyPreview')}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground">{formatRelativeTime(session.last_message_at, locale)}</span>
            {session.message_count > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <MessageSquare className="w-2.5 h-2.5" />
                {session.message_count}
              </span>
            )}
          </div>
        </div>
      </button>

      {!isRenaming && (
        <button
          onClick={e => {
            e.stopPropagation()
            onToggleMenu()
          }}
          className="absolute top-3 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all"
        >
          <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}

      <AnimatePresence>
        {isMenuOpen && !isRenaming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-10 right-2 z-20 glass-panel rounded-xl py-1 min-w-[140px] shadow-xl"
          >
            <button
              onClick={onBeginRename}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors"
            >
              <Pencil className="w-3 h-3" />
              {t('common.rename')}
            </button>
            <button
              onClick={onTogglePin}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors"
            >
              <Pin className="w-3 h-3" />
              {session.is_pinned ? t('common.unpin') : t('common.pin')}
            </button>
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              {t('common.delete')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function resolvePersonaName(session: ChatSessionSummary, locale: 'zh' | 'en'): string {
  const persona: Persona = {
    id: session.persona_id || 'history-persona',
    name: session.persona_name || '',
    name_en: session.persona_name_en || undefined,
    avatar: session.persona_avatar || '',
    prompt: '',
    reply_style: 'medium',
  }

  return localizePersona(persona, locale)?.name || session.persona_name_en || session.persona_name || ''
}
