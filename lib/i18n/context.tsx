'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Locale } from './config'
import { localeStorageKey } from './config'
import { dictionaries } from './dictionaries'

type Dictionary = (typeof dictionaries)[Locale]

type I18nContextValue = {
  locale: Locale
  dict: Dictionary
  t: (value: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function resolvePath(dict: Dictionary, value: string): string {
  const result = value.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, dict)

  return typeof result === 'string' ? result : value
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const dict = dictionaries[locale]

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
    localStorage.setItem(localeStorageKey, locale)
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dict,
      t: (path, vars) => interpolate(resolvePath(dict, path), vars),
    }),
    [dict, locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}
