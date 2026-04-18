export const locales = ['zh', 'en'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'
export const localeStorageKey = 'myai-locale'

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

export function normalizeLocale(value?: string | null): Locale {
  if (!value) return defaultLocale
  const lower = value.toLowerCase()
  if (lower.startsWith('zh')) return 'zh'
  if (lower.startsWith('en')) return 'en'
  return defaultLocale
}

export function withLocale(pathname: string, locale: Locale): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const segments = normalized.split('/')
  const first = segments[1]

  if (isLocale(first)) {
    segments[1] = locale
    return segments.join('/') || `/${locale}`
  }

  if (normalized === '/') return `/${locale}`
  return `/${locale}${normalized}`
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}
