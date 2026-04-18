'use client'

import { Globe, Brain, UserRoundPen, Users } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { localeStorageKey, withLocale, type Locale } from '@/lib/i18n/config'

interface Props {
  onClose: () => void
  onEditPersona: () => void
  onOpenMemory: () => void
  onSwitchPersona: () => void
}

export default function SettingsPanel({ onClose, onEditPersona, onOpenMemory, onSwitchPersona }: Props) {
  const { locale, t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()

  function switchLocale(nextLocale: Locale) {
    if (nextLocale === locale) return
    localStorage.setItem(localeStorageKey, nextLocale)
    router.push(withLocale(pathname, nextLocale))
    onClose()
  }

  const actions = [
    { icon: UserRoundPen, label: t('sidebar.editPersona'), onClick: onEditPersona },
    { icon: Brain, label: t('sidebar.memory'), onClick: onOpenMemory },
    { icon: Users, label: t('sidebar.switchPersona'), onClick: onSwitchPersona },
  ]

  return (
    <div
      className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-[520px] max-h-[85vh] bg-paper rounded-2xl shadow-modal border border-paper-deep flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-paper-deep">
          <div>
            <div className="font-serif text-[18px] text-ink">{t('settings.title')}</div>
            <div className="text-xs text-ink-mute mt-0.5">{t('settings.description')}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-paper-warm text-ink-mute">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 overflow-y-auto">
          <section>
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <Globe className="w-4 h-4" />
              {t('settings.interfaceLanguage')}
            </div>
            <p className="text-xs text-ink-mute mt-2">{t('settings.interfaceLanguageHint')}</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {([
                { key: 'zh', label: t('settings.chinese') },
                { key: 'en', label: t('settings.english') },
              ] as const).map(option => (
                <button
                  key={option.key}
                  onClick={() => switchLocale(option.key)}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    locale === option.key
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-paper-deep bg-white text-ink hover:border-accent-soft'
                  }`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-[11px] mt-1 opacity-75">/{option.key}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink-mute mt-3">{t('settings.languageAutoNote')}</p>
          </section>

          <section>
            <div className="text-sm font-medium text-ink">{t('settings.actions')}</div>
            <p className="text-xs text-ink-mute mt-2">{t('settings.actionsHint')}</p>
            <div className="space-y-2 mt-4">
              {actions.map(action => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className="w-full flex items-center gap-3 rounded-xl border border-paper-deep bg-white px-4 py-3 text-sm text-ink transition-all hover:border-accent-soft"
                  >
                    <Icon className="w-4 h-4 text-ink-mute" />
                    {action.label}
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
