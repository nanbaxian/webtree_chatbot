import type { ReplyLanguage } from '@/types'

const CJK_RE = /[\u4e00-\u9fff]/
const HANGUL_RE = /[\uac00-\ud7af]/
const KANA_RE = /[\u3040-\u30ff]/
const CYRILLIC_RE = /[\u0400-\u04ff]/
const ARABIC_RE = /[\u0600-\u06ff]/
const LATIN_RE = /[a-z]/i

const LANGUAGE_KEYWORDS: Array<{ lang: ReplyLanguage; pattern: RegExp }> = [
  { lang: 'fr', pattern: /\b(bonjour|merci|comment|pourquoi|oui|non|s'il vous plaît|s’il vous plaît|aujourd'hui|cela)\b/i },
  { lang: 'ko', pattern: /\b(안녕|감사|무엇|어떻게|왜|예|아니오)\b/ },
  { lang: 'es', pattern: /\b(hola|gracias|cómo|porque|sí|no|por favor|buenos días)\b/i },
  { lang: 'de', pattern: /\b(hallo|danke|warum|wie|bitte|ja|nein)\b/i },
  { lang: 'pt', pattern: /\b(olá|obrigado|obrigada|como|porque|sim|não|por favor)\b/i },
  { lang: 'it', pattern: /\b(ciao|grazie|come|perché|si|no|per favore)\b/i },
  { lang: 'ru', pattern: /\b(привет|спасибо|как|почему|да|нет|пожалуйста)\b/i },
  { lang: 'ar', pattern: /\b(مرحبا|شكرا|كيف|لماذا|نعم|لا|من فضلك)\b/ },
]

const LANGUAGE_RULES: Record<ReplyLanguage, string> = {
  zh: 'Reply fully in Simplified Chinese.',
  en: 'Reply fully in natural English.',
  fr: 'Reply fully in natural French.',
  ko: 'Reply fully in natural Korean.',
  ja: 'Reply fully in natural Japanese.',
  es: 'Reply fully in natural Spanish.',
  de: 'Reply fully in natural German.',
  pt: 'Reply fully in natural Portuguese.',
  ru: 'Reply fully in natural Russian.',
  ar: 'Reply fully in natural Arabic.',
  it: 'Reply fully in natural Italian.',
}

const LANGUAGE_LOCALE: Record<ReplyLanguage, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  fr: 'fr-FR',
  ko: 'ko-KR',
  ja: 'ja-JP',
  es: 'es-ES',
  de: 'de-DE',
  pt: 'pt-BR',
  ru: 'ru-RU',
  ar: 'ar-SA',
  it: 'it-IT',
}

export function detectReplyLanguageFromText(
  text: string | undefined | null,
  fallback: ReplyLanguage = 'zh',
): ReplyLanguage {
  const value = (text || '').trim()
  if (!value) return fallback

  if (HANGUL_RE.test(value)) return 'ko'
  if (KANA_RE.test(value)) return 'ja'
  if (ARABIC_RE.test(value)) return 'ar'
  if (CYRILLIC_RE.test(value)) return 'ru'
  if (CJK_RE.test(value)) return 'zh'

  for (const entry of LANGUAGE_KEYWORDS) {
    if (entry.pattern.test(value)) return entry.lang
  }

  const hasLatin = LATIN_RE.test(value)
  if (hasLatin) return 'en'
  return fallback
}

export function getLanguageReplyRule(language: ReplyLanguage): string {
  return LANGUAGE_RULES[language] || LANGUAGE_RULES.en
}

export function getLanguageLocale(language: ReplyLanguage): string {
  return LANGUAGE_LOCALE[language] || LANGUAGE_LOCALE.en
}
