import type { Persona, ReplyLanguage } from '@/types'
import type { Locale } from '@/lib/i18n/config'

const PERSONA_FALLBACKS: Record<string, { name: string; prompt: string }> = {
  晓雨: {
    name: 'Xiaoyu',
    prompt: 'Xiaoyu is a gentle, empathetic companion who loves literature and music.',
  },
  阿福: {
    name: 'Afu',
    prompt: 'Afu is bright, playful, and good at easing tension with warm humor.',
  },
  小哲: {
    name: 'Theo',
    prompt: 'Theo is calm, analytical, and thoughtful without sounding cold.',
  },
}

export function localizePersona(persona: Persona | null, locale: Locale): Persona | null {
  if (!persona) return null
  if (locale === 'zh') return persona

  const fallback = PERSONA_FALLBACKS[persona.name]

  return {
    ...persona,
    name: persona.name_en || fallback?.name || persona.name,
    prompt: persona.prompt_en || fallback?.prompt || persona.prompt,
  }
}

export function localizePersonaForReplyLanguage(persona: Persona | null, language: ReplyLanguage): Persona | null {
  return localizePersona(persona, language === 'en' ? 'en' : 'zh')
}
