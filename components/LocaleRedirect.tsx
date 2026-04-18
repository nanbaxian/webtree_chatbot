'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { defaultLocale, localeStorageKey, normalizeLocale } from '@/lib/i18n/config'

export default function LocaleRedirect() {
  const router = useRouter()

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(localeStorageKey) : null
    const browser = typeof navigator !== 'undefined' ? navigator.language : null
    const locale = normalizeLocale(saved || browser || defaultLocale)
    router.replace(`/${locale}`)
  }, [router])

  return null
}
