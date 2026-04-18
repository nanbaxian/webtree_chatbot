'use client'

import { useState, useEffect, useRef } from 'react'
import { Persona } from '@/types'
import { apiUrl } from '@/lib/api-url'
import { useI18n } from '@/lib/i18n/context'
import { dictionaries } from '@/lib/i18n/dictionaries'

interface Props {
  persona: Persona | null
  onSave: (persona: Persona) => void
  onClose: () => void
}

const EMOJI_OPTIONS = ['🌸', '🌙', '⭐', '🌊', '🦋', '🌿', '🔥', '❄️', '🌹', '🍀', '✨', '🎭']

export default function PersonaModal({ persona, onSave, onClose }: Props) {
  const { dict, t } = useI18n()
  const [name, setName] = useState(persona?.name || '')
  const [nameEn, setNameEn] = useState(persona?.name_en || '')
  const [avatar, setAvatar] = useState(persona?.avatar || '🌸')
  const [prompt, setPrompt] = useState(persona?.prompt || '')
  const [promptEn, setPromptEn] = useState(persona?.prompt_en || '')
  const [replyStyle, setReplyStyle] = useState<'short' | 'medium' | 'long'>(persona?.reply_style || 'medium')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const overlayRef = useRef<HTMLDivElement>(null)
  const charCount = prompt.length
  const charCountEn = promptEn.length
  const isOver = charCount > 1000 || charCountEn > 1000

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('personaModal.nameRequired'))
      return
    }
    if (isOver) {
      setError(t('personaModal.promptTooLong'))
      return
    }
    setError('')
    setSaving(true)

    try {
      const res = await fetch(apiUrl('/api/persona'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          name_en: nameEn.trim() || null,
          avatar,
          prompt,
          prompt_en: promptEn.trim() || null,
          reply_style: replyStyle,
        }),
      })

      if (!res.ok) throw new Error('save failed')
      const updated = (await res.json()) as Persona
      if (!updated || !updated.id) throw new Error('save failed')
      onSave(updated)
    } catch {
      setError(t('personaModal.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in"
    >
      <div className="w-[560px] max-h-[85vh] bg-paper rounded-2xl shadow-2xl border border-paper-deep flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-paper-deep flex-shrink-0">
          <div className="font-serif text-[18px] text-ink">{t('personaModal.title')}</div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-paper-warm text-ink-mute hover:text-ink transition-all flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div>
            <label className="field-label">{t('personaModal.avatar')}</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setAvatar(emoji)}
                  className={`w-10 h-10 rounded-xl text-xl transition-all ${
                    avatar === emoji
                      ? 'bg-accent/15 border-2 border-accent shadow-sm scale-110'
                      : 'bg-paper-warm border border-paper-deep hover:border-accent-soft hover:scale-105'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label">{t('personaModal.name')}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t('personaModal.namePlaceholder')} className="field-input mt-1.5" maxLength={20} />
          </div>

          <div>
            <label className="field-label">{t('personaModal.nameEnglish')}</label>
            <input
              value={nameEn}
              onChange={e => setNameEn(e.target.value)}
              placeholder={t('personaModal.nameEnglishPlaceholder')}
              className="field-input mt-1.5"
              maxLength={40}
            />
          </div>

          <div>
            <label className="field-label">
              {t('personaModal.prompt')}
              <span className="text-ink-mute font-normal text-[10px] ml-1 lowercase tracking-normal">{t('personaModal.promptHint')}</span>
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={t('personaModal.promptPlaceholder')}
              rows={8}
              className={`field-input mt-1.5 resize-y min-h-[180px] leading-[1.75] ${
                isOver ? 'border-accent focus:shadow-[0_0_0_3px_rgba(196,67,42,0.2)]' : ''
              }`}
            />
            <div className={`text-right text-[11px] mt-1 ${isOver ? 'text-accent font-medium' : 'text-ink-mute'}`}>
              {charCount} / 1000 {isOver && t('personaModal.overLimit')}
            </div>
          </div>

          <div>
            <label className="field-label">
              {t('personaModal.promptEnglish')}
              <span className="text-ink-mute font-normal text-[10px] ml-1 lowercase tracking-normal">{t('personaModal.promptEnglishHint')}</span>
            </label>
            <textarea
              value={promptEn}
              onChange={e => setPromptEn(e.target.value)}
              placeholder={dictionaries.en.personaModal.promptPlaceholder}
              rows={6}
              className={`field-input mt-1.5 resize-y min-h-[150px] leading-[1.75] ${
                charCountEn > 1000 ? 'border-accent focus:shadow-[0_0_0_3px_rgba(196,67,42,0.2)]' : ''
              }`}
            />
            <div className={`text-right text-[11px] mt-1 ${charCountEn > 1000 ? 'text-accent font-medium' : 'text-ink-mute'}`}>
              {charCountEn} / 1000 {charCountEn > 1000 && t('personaModal.overLimit')}
            </div>
          </div>

          <div>
            <label className="field-label">{t('personaModal.replyStyle')}</label>
            <div className="flex gap-2 mt-1.5">
              {(['short', 'medium', 'long'] as const).map(style => (
                <button
                  key={style}
                  onClick={() => setReplyStyle(style)}
                  className={`flex-1 py-2.5 rounded-xl text-sm transition-all border ${
                    replyStyle === style
                      ? 'bg-accent/10 border-accent text-accent font-medium'
                      : 'bg-paper-warm border-paper-deep text-ink-mute hover:border-ink-mute hover:text-ink'
                  }`}
                >
                  {dict.personaModal.styleLabels[style]}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-accent text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-paper-deep flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-paper-deep text-ink-mute hover:bg-paper-warm hover:text-ink transition-all text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isOver || !name.trim()}
            className="px-5 py-2 rounded-xl bg-accent text-white text-sm font-medium shadow-[0_2px_8px_rgba(196,67,42,0.25)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? t('common.saving') : t('personaModal.savePersona')}
          </button>
        </div>
      </div>
    </div>
  )
}
