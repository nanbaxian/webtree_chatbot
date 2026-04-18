'use client'

import { useRef, useState } from 'react'
import { ImageIcon, Phone, SendHorizontal, X } from 'lucide-react'
import { Persona, ReplyLanguage } from '@/types'
import { supabase } from '@/lib/supabase-browser'
import { apiUrl } from '@/lib/api-url'
import { useI18n } from '@/lib/i18n/context'

interface Props {
  onSend: (text: string, imageUrl?: string, imagePreviewUrl?: string, replyLanguage?: ReplyLanguage) => Promise<string | null> | void
  disabled?: boolean
  persona: Persona | null
  onStartVoiceCall: () => void
  voiceCallOpen?: boolean
}

async function uploadFileToR2(file: File, token: string): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(apiUrl('/api/upload'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error('upload failed')
  return await res.json()
}

export default function InputArea({
  onSend,
  disabled,
  persona,
  onStartVoiceCall,
  voiceCallOpen,
}: Props) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [pendingImage, setPendingImage] = useState<{ preview: string } | null>(null)
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [uiError, setUiError] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = await compressImage(file, 800 * 1024)
    setPendingImage({ preview })
    setPendingImageFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if ((!trimmed && !pendingImage) || disabled) return

    ;(async () => {
      try {
        if (pendingImageFile) {
          const sess = await supabase.auth.getSession()
          const token = sess.data.session?.access_token
          if (!token) {
            setUiError(t('input.loginBeforeImage'))
            setTimeout(() => setUiError(''), 3000)
            return
          }
          const up = await uploadFileToR2(pendingImageFile, token)
          await onSend(trimmed, up.url, pendingImage?.preview)
        } else {
          await onSend(trimmed)
        }

        setText('')
        setPendingImage(null)
        setPendingImageFile(null)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
      } catch {
        setUiError(t('input.sendFailed'))
        setTimeout(() => setUiError(''), 3000)
      }
    })()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const placeholder = persona?.name ? t('chat.sayToPersona', { name: persona.name }) : t('chat.sayToHer')

  return (
    <div className="px-5 py-3 border-t border-border bg-card/70 backdrop-blur-sm flex-shrink-0">
      {pendingImage && (
        <div className="mb-3 relative inline-block">
          <img src={pendingImage.preview} alt={t('chat.imagePreviewAlt')} className="h-16 w-auto rounded-lg border border-border object-cover" />
          <button
            onClick={() => {
              setPendingImage(null)
              setPendingImageFile(null)
            }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-secondary text-muted-foreground text-xs flex items-center justify-center hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => fileInputRef.current?.click()} className="tool-btn" title={t('chat.uploadImage')} disabled={disabled}>
          <ImageIcon className="w-4 h-4" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => {
              setText(e.target.value)
              autoResize()
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className="w-full min-h-[54px] max-h-[120px] px-5 py-[14px] pr-28 rounded-2xl border border-border bg-input
              text-foreground text-[14px] leading-[1.35] resize-none outline-none transition-all
              placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20
              disabled:opacity-60 disabled:cursor-not-allowed"
          />

          <button
            onClick={onStartVoiceCall}
            title={t('chat.voiceChat')}
            disabled={disabled}
            className={`absolute right-[58px] top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl border flex items-center justify-center transition-all ${
              voiceCallOpen
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-secondary/70 border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Phone className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={handleSend}
            disabled={disabled || (!text.trim() && !pendingImage)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center
              transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SendHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {uiError && <div className="mt-2 text-[11px] text-muted-foreground">{uiError}</div>}
    </div>
  )
}

async function compressImage(file: File, maxBytes: number): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        const maxDim = 1600
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

        let quality = 0.85
        let result = canvas.toDataURL('image/jpeg', quality)
        while (result.length > maxBytes * 1.37 && quality > 0.3) {
          quality -= 0.1
          result = canvas.toDataURL('image/jpeg', quality)
        }
        resolve(result)
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}
