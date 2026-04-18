'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { useI18n } from '@/lib/i18n/context'
import { getSiteUrl } from '@/lib/i18n/config'

type Props = {
  className?: string
}

export default function AuthWidget({ className }: Props) {
  const { locale, t } = useI18n()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)

  const canUseSupabase = useMemo(() => {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSessionEmail(data.session?.user?.email ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSessionEmail(sess?.user?.email ?? null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const sendMagicLink = async () => {
    if (!email.trim()) return
    setStatus('sending')
    try {
      const redirectBase =
        process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL ||
        (typeof window !== 'undefined' ? window.location.origin : getSiteUrl())
      const callbackUrl = new URL('/auth/callback', redirectBase)
      callbackUrl.searchParams.set('locale', locale)

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: callbackUrl.toString(),
        },
      })
      if (error) throw error
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 5000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  if (!canUseSupabase) {
    return (
      <div className={className}>
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          {t('auth.missingConfig')}
          <br />
          <span className="text-[10px]">NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {sessionEmail ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">{t('auth.loggedIn')}</div>
            <div className="truncate text-[12px] text-foreground">{sessionEmail}</div>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
          >
            {t('sidebar.logout')}
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-2 text-[11px] text-muted-foreground">{t('auth.voiceHint')}</div>
          <div className="flex gap-2">
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-[12px] text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={sendMagicLink}
              disabled={!email.trim() || status === 'sending'}
              className="rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground disabled:opacity-40"
            >
              {status === 'sending' ? t('auth.sending') : t('auth.magicLink')}
            </button>
          </div>
          {status === 'sent' && <div className="mt-2 text-[11px] text-green-400">{t('auth.sent')}</div>}
          {status === 'error' && <div className="mt-2 text-[11px] text-red-400">{t('auth.sendFailed')}</div>}
        </div>
      )}
    </div>
  )
}
