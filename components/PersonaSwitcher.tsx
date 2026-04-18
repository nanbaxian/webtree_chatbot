'use client'

import { useCallback, useEffect, useState } from 'react'
import { Persona } from '@/types'
import { apiUrl } from '@/lib/api-url'
import { useI18n } from '@/lib/i18n/context'
import { localizePersona } from '@/lib/persona-localization'

interface Props {
  currentPersona: Persona | null
  onSwitch: (persona: Persona) => void
  onClose: () => void
}

export default function PersonaSwitcher({ currentPersona, onSwitch, onClose }: Props) {
  const { locale, t } = useI18n()
  const presetPersonas: Omit<Persona, 'id'>[] = [
    {
      name: '晓雨',
      name_en: 'Xiaoyu',
      avatar: '🌸',
      reply_style: 'medium',
      prompt: '你叫晓雨，温柔体贴，善解人意，喜欢文学和音乐，说话自然随性但有自己的观点。',
      prompt_en: 'Warm, observant, emotionally attentive, and softly expressive. Loves literature and music.',
    },
    {
      name: '小哲',
      name_en: 'Theo',
      avatar: '🌊',
      reply_style: 'medium',
      prompt: '你叫小哲，理性冷静但不失温度，擅长倾听、分析问题并给出真诚建议。',
      prompt_en: 'Calm and analytical, but never cold. A strong listener who gives thoughtful advice.',
    },
    {
      name: '阿福',
      name_en: 'Afu',
      avatar: '🍀',
      reply_style: 'short',
      prompt: '你叫阿福，阳光开朗，轻松幽默，擅长用松弛感化解紧张情绪。',
      prompt_en: 'Bright, playful, and easygoing. Good at easing tension with warm humor.',
    },
  ]

  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNameEn, setNewNameEn] = useState('')
  const [newAvatar, setNewAvatar] = useState('⭐')
  const [newPrompt, setNewPrompt] = useState('')
  const [newPromptEn, setNewPromptEn] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadPersonas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/personas'))
      if (!res.ok) throw new Error('load failed')
      const data = (await res.json()) as Persona[]
      setPersonas(Array.isArray(data) ? data : [])
    } catch {
      setError(t('personaSwitcher.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadPersonas()
  }, [loadPersonas])

  async function switchTo(persona: Persona) {
    if (persona.id === currentPersona?.id) {
      onClose()
      return
    }
    setSwitching(persona.id)
    setError('')
    try {
      const res = await fetch(apiUrl('/api/personas/active'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: persona.id }),
      })
      if (!res.ok) throw new Error('switch failed')
      onSwitch(persona)
      onClose()
    } catch {
      setError(t('personaSwitcher.switchFailed'))
    } finally {
      setSwitching(null)
    }
  }

  async function createFromPreset(preset: Omit<Persona, 'id'>) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(apiUrl('/api/personas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      })
      if (!res.ok) throw new Error('create failed')
      const created = (await res.json()) as Persona
      if (!created?.id) throw new Error('create failed')
      setPersonas(prev => [...prev, created])
      await switchTo(created)
    } catch {
      setError(t('personaSwitcher.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function createNew() {
    if (!newName.trim() || !newPrompt.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(apiUrl('/api/personas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          name_en: newNameEn.trim() || null,
          avatar: newAvatar,
          prompt: newPrompt,
          prompt_en: newPromptEn.trim() || null,
          reply_style: 'medium',
        }),
      })
      if (!res.ok) throw new Error('create failed')
      const created = (await res.json()) as Persona
      if (!created?.id) throw new Error('create failed')
      setPersonas(prev => [...prev, created])
      setShowNew(false)
      setNewName('')
      setNewNameEn('')
      setNewAvatar('⭐')
      setNewPrompt('')
      setNewPromptEn('')
      await switchTo(created)
    } catch {
      setError(t('personaSwitcher.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function deletePersona(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (id === currentPersona?.id) return
    if (!confirm(t('personaSwitcher.confirmDelete'))) return
    setError('')
    try {
      const res = await fetch(apiUrl(`/api/personas?id=${id}`), { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setPersonas(prev => prev.filter(p => p.id !== id))
    } catch {
      setError(t('personaSwitcher.deleteFailed'))
    }
  }

  const emojis = ['🌸', '🌊', '⭐', '🍀', '🔥', '❄️', '🌙', '🦋', '🌿', '🎭', '✨', '🌹']

  return (
    <div
      className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-[560px] max-h-[85vh] bg-paper rounded-2xl shadow-modal border border-paper-deep flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-paper-deep flex-shrink-0">
          <div>
            <div className="font-serif text-[18px] text-ink">{t('personaSwitcher.title')}</div>
            <div className="text-xs text-ink-mute mt-0.5">{t('personaSwitcher.subtitle')}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-paper-warm text-ink-mute flex items-center justify-center">
            ×
          </button>
        </div>

        {error && <div className="mx-6 mt-3 px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200">{error}</div>}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-ink-mute text-sm animate-pulse">{t('common.loading')}</div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-widest text-ink-mute mb-2">{t('personaSwitcher.myPersonas')}</div>
              {personas.map(p => {
                const displayPersona = localizePersona(p, locale) ?? p
                return (
                  <div
                    key={p.id}
                    onClick={() => switchTo(p)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all group ${
                      p.id === currentPersona?.id ? 'border-accent bg-accent/5' : 'border-paper-deep bg-white hover:border-accent-soft hover:shadow-sm'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-soft to-accent flex items-center justify-center text-xl flex-shrink-0">
                      {displayPersona.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink text-sm">{displayPersona.name}</span>
                        {p.id === currentPersona?.id && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent">{t('personaSwitcher.current')}</span>}
                      </div>
                      <div className="text-xs text-ink-mute mt-0.5 truncate">{displayPersona.prompt?.slice(0, 60)}...</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {switching === p.id && <span className="text-xs text-ink-mute animate-pulse">{t('personaSwitcher.switching')}</span>}
                      {p.id !== currentPersona?.id && (
                        <button
                          onClick={e => deletePersona(p.id, e)}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg text-ink-mute hover:text-accent hover:bg-red-50 flex items-center justify-center transition-all text-xs"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div>
            <div className="text-[11px] uppercase tracking-widest text-ink-mute mb-2">{t('personaSwitcher.presetTemplates')}</div>
            <div className="grid grid-cols-3 gap-2">
              {presetPersonas.map(p => {
                const exists = personas.some(ep => ep.name === p.name)
                const displayPreset = localizePersona({ id: p.name, ...p }, locale) ?? ({ id: p.name, ...p } as Persona)
                return (
                  <button
                    key={p.name}
                    onClick={() => !exists && createFromPreset(p)}
                    disabled={exists || saving}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      exists ? 'border-paper-deep bg-paper-warm opacity-50 cursor-not-allowed' : 'border-paper-deep bg-white hover:border-accent-soft hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    <div className="text-2xl mb-1.5">{displayPreset.avatar}</div>
                    <div className="text-sm font-medium text-ink">{displayPreset.name}</div>
                    <div className="text-[10px] text-ink-mute mt-0.5 line-clamp-2">{displayPreset.prompt.slice(0, 45)}...</div>
                    {exists && <div className="text-[10px] text-ink-mute mt-1">{t('personaSwitcher.created')}</div>}
                  </button>
                )
              })}
            </div>
          </div>

          {showNew ? (
            <div className="border border-paper-deep rounded-xl p-4 space-y-3">
              <div className="text-sm font-medium text-ink">{t('personaSwitcher.newPersona')}</div>

              <div className="flex flex-wrap gap-1.5">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setNewAvatar(emoji)}
                    className={`w-8 h-8 rounded-lg text-base transition-all ${
                      newAvatar === emoji ? 'bg-accent/15 border-2 border-accent scale-110' : 'bg-paper-warm border border-paper-deep hover:scale-105'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={t('personaSwitcher.newNamePlaceholder')}
                className="field-input text-sm"
                maxLength={10}
              />
              <input
                value={newNameEn}
                onChange={e => setNewNameEn(e.target.value)}
                placeholder={t('personaModal.nameEnglishPlaceholder')}
                className="field-input text-sm"
                maxLength={40}
              />
              <textarea
                value={newPrompt}
                onChange={e => setNewPrompt(e.target.value)}
                placeholder={t('personaSwitcher.newPromptPlaceholder')}
                rows={4}
                className="field-input text-sm resize-none leading-relaxed"
                maxLength={1000}
              />
              <textarea
                value={newPromptEn}
                onChange={e => setNewPromptEn(e.target.value)}
                placeholder={t('personaModal.promptEnglish')}
                rows={4}
                className="field-input text-sm resize-none leading-relaxed"
                maxLength={1000}
              />
              <div className="text-right text-[11px] text-ink-mute">
                zh {newPrompt.length}/1000 · en {newPromptEn.length}/1000
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg border border-paper-deep text-sm text-ink-mute hover:bg-paper-warm">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={createNew}
                  disabled={saving || !newName.trim() || !newPrompt.trim()}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-sm shadow-glow transition-all disabled:opacity-40"
                >
                  {saving ? t('common.saving') : t('personaSwitcher.createAndSwitch')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="w-full py-3 rounded-xl border border-dashed border-paper-deep text-sm text-ink-mute hover:border-accent-soft hover:text-accent hover:bg-accent/5 transition-all"
            >
              + {t('personaSwitcher.createNew')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
