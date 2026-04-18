'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CoreMemory, MemorySnapshot as Snapshot } from '@/types'
import { apiUrl } from '@/lib/api-url'
import { useI18n } from '@/lib/i18n/context'

interface Props {
  onClose: () => void
}

export default function MemoryManager({ onClose }: Props) {
  const { locale, dict, t } = useI18n()
  const [tab, setTab] = useState<'core' | 'snapshots'>('core')
  const [coreMemories, setCore] = useState<CoreMemory[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [compressing, setCompress] = useState(false)
  const [msg, setMsg] = useState('')
  const [success, setSuccess] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, sRes] = await Promise.all([fetch(apiUrl('/api/memory/core')), fetch(apiUrl('/api/memory/snapshots'))])
      if (cRes.ok) setCore((await cRes.json()) as CoreMemory[])
      if (sRes.ok) setSnapshots((await sRes.json()) as Snapshot[])
    } catch {
      setSuccess(false)
      setMsg(t('memory.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function deleteCore(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(apiUrl(`/api/memory/core?id=${id}`), { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setCore(prev => prev.filter(m => m.id !== id))
    } catch {
      setSuccess(false)
      setMsg(t('memory.deleteFailed'))
    } finally {
      setDeleting(null)
    }
  }

  async function deleteSnapshot(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(apiUrl(`/api/memory/snapshots?id=${id}`), { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setSnapshots(prev => prev.filter(s => s.id !== id))
    } catch {
      setSuccess(false)
      setMsg(t('memory.deleteFailed'))
    } finally {
      setDeleting(null)
    }
  }

  async function triggerCompress() {
    setCompress(true)
    setMsg('')
    try {
      const res = await fetch(apiUrl('/api/memory/compress'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      let data: { success?: boolean; error?: string } = {}
      try {
        data = await res.json()
      } catch {
        // ignore non-json
      }
      if (res.ok && data.success) {
        setSuccess(true)
        setMsg(t('memory.compressDone'))
        void loadAll()
      } else {
        setSuccess(false)
        setMsg(t('memory.compressFailed', { error: data.error ?? `HTTP ${res.status}` }))
      }
    } catch {
      setSuccess(false)
      setMsg(t('memory.requestFailed'))
    } finally {
      setCompress(false)
    }
  }

  const tierConfig = {
    mid: {
      ...dict.memory.tiers.mid,
      color: 'border-yellow-400 bg-yellow-50',
      badge: 'bg-yellow-100 text-yellow-700',
    },
    long: {
      ...dict.memory.tiers.long,
      color: 'border-stone-300 bg-stone-50',
      badge: 'bg-stone-100 text-stone-500',
    },
  }

  const midSnaps = snapshots.filter(s => s.tier === 'mid')
  const longSnaps = snapshots.filter(s => s.tier === 'long')
  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US'

  return (
    <div
      className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-[680px] max-h-[85vh] bg-paper rounded-2xl shadow-modal border border-paper-deep flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-paper-deep flex-shrink-0">
          <div>
            <div className="font-serif text-[18px] text-ink">{t('memory.title')}</div>
            <div className="text-xs text-ink-mute mt-0.5">{t('memory.subtitle')}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerCompress}
              disabled={compressing}
              className="px-3 py-1.5 rounded-lg border border-paper-deep text-xs text-ink-mute hover:bg-paper-warm hover:text-ink transition-all disabled:opacity-40"
            >
              {compressing ? t('memory.compressing') : t('memory.compressNow')}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-paper-warm text-ink-mute flex items-center justify-center transition-all">
              ×
            </button>
          </div>
        </div>

        {msg && (
          <div className={`mx-6 mt-3 px-3 py-2 rounded-lg text-xs ${success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg}
          </div>
        )}

        <div className="flex gap-1 px-6 pt-4 pb-0 flex-shrink-0">
          {(['core', 'snapshots'] as const).map(item => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`px-4 py-2 rounded-t-lg text-sm transition-all border-b-2 ${
                tab === item ? 'border-accent text-accent font-medium' : 'border-transparent text-ink-mute hover:text-ink'
              }`}
            >
              {item === 'core' ? `${t('memory.coreTab')} (${coreMemories.length})` : `${t('memory.snapshotsTab')} (${snapshots.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-12 text-ink-mute text-sm animate-pulse">{t('memory.loading')}</div>
          ) : tab === 'core' ? (
            <div className="space-y-2">
              {coreMemories.length === 0 && (
                <div className="text-center py-12 text-ink-mute text-sm">
                  {t('memory.noCore')}
                  <br />
                  <span className="text-xs">{t('memory.noCoreHint')}</span>
                </div>
              )}
              {coreMemories.map(m => (
                <div key={m.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-paper-deep hover:border-amber-300 transition-all group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium uppercase tracking-wide">
                        {dict.memory.categories[m.category as keyof typeof dict.memory.categories] ?? m.category}
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < Math.round(m.importance / 2) ? 'bg-amber-400' : 'bg-paper-deep'}`} />
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-ink leading-relaxed">{m.fact}</div>
                    <div className="text-[11px] text-ink-mute mt-1">
                      {new Date(m.created_at ?? Date.now()).toLocaleDateString(dateLocale)}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteCore(m.id)}
                    disabled={deleting === m.id}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg text-ink-mute hover:text-accent hover:bg-red-50 flex items-center justify-center transition-all text-sm flex-shrink-0"
                  >
                    {deleting === m.id ? '...' : '×'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {([
                { tier: 'mid', list: midSnaps, cfg: tierConfig.mid },
                { tier: 'long', list: longSnaps, cfg: tierConfig.long },
              ] as const).map(({ tier, list, cfg }) => (
                <div key={tier}>
                  <div className="text-[11px] uppercase tracking-widest text-ink-mute mb-2 flex items-center gap-2">
                    {cfg.label}
                    <span className="text-[10px] normal-case tracking-normal">{cfg.desc}</span>
                    <div className="flex-1 h-px bg-paper-deep" />
                    <span>{t('common.items', { count: list.length })}</span>
                  </div>
                  {list.length === 0 && <div className="text-xs text-ink-mute py-3 pl-2">{t('memory.emptyTier')}</div>}
                  {list.map(s => (
                    <div key={s.id} className={`p-3.5 rounded-xl border-l-2 mb-2 ${cfg.color} group relative`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                              {t('memory.clarity')} {Math.round(s.clarity_score * 100)}%
                            </span>
                            {s.emotional_tone && <span className="text-[10px] text-ink-mute">{s.emotional_tone}</span>}
                          </div>
                          <div className="text-sm text-ink leading-relaxed">{s.summary_text}</div>
                          {s.key_facts?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {s.key_facts.map((f, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 bg-white/70 rounded-full text-ink-soft border border-paper-deep">
                                  {f}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="text-[11px] text-ink-mute mt-2">
                            {new Date(s.period_start).toLocaleDateString(dateLocale)} - {new Date(s.period_end).toLocaleDateString(dateLocale)}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteSnapshot(s.id)}
                          disabled={deleting === s.id}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg text-ink-mute hover:text-accent hover:bg-white flex items-center justify-center transition-all text-sm flex-shrink-0"
                        >
                          {deleting === s.id ? '...' : '×'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
