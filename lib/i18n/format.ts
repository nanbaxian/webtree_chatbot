import type { Locale } from './config'
import { dictionaries } from './dictionaries'

export function formatRelativeTime(input: string, locale: Locale): string {
  const date = new Date(input)
  const diff = Date.now() - date.getTime()

  if (Number.isNaN(date.getTime())) return ''

  const dict = dictionaries[locale].common
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return dict.justNow
  if (minutes < 60) return dict.minutesAgo.replace('{count}', String(minutes))
  if (hours < 24) return dict.hoursAgo.replace('{count}', String(hours))
  if (days < 7) return dict.daysAgo.replace('{count}', String(days))

  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}
