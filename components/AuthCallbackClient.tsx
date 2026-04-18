'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { localeStorageKey, normalizeLocale, type Locale } from '@/lib/i18n/config'

const copy = {
  zh: {
    loading: '正在完成登录...',
    success: '登录成功，正在跳转...',
    failed: '登录失败，请重新打开邮件链接或再次发送 Magic Link。',
  },
  en: {
    loading: 'Completing sign-in...',
    success: 'Signed in. Redirecting...',
    failed: 'Sign-in failed. Please reopen the email link or request a new Magic Link.',
  },
} as const

function getPreferredLocale(raw?: string | null): Locale {
  return normalizeLocale(raw || (typeof navigator !== 'undefined' ? navigator.language : null))
}

export default function AuthCallbackClient() {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('en')
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')

  useEffect(() => {
    let active = true

    async function finishSignIn() {
      try {
        const url = new URL(window.location.href)
        const nextLocale = getPreferredLocale(url.searchParams.get('locale') || localStorage.getItem(localeStorageKey))
        if (active) setLocale(nextLocale)
        const code = url.searchParams.get('code')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) throw error
        if (!session) throw new Error('missing session')

        localStorage.setItem(localeStorageKey, nextLocale)
        if (!active) return
        setStatus('success')
        router.replace('/dashboard')
      } catch {
        if (!active) return
        setStatus('failed')
      }
    }

    void finishSignIn()

    return () => {
      active = false
    }
  }, [router])

  const text = copy[locale]

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/70 p-8 text-center shadow-2xl backdrop-blur-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
          ✨
        </div>
        <h1 className="font-serif text-2xl text-foreground">KnowledgeOS</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {status === 'loading' ? text.loading : status === 'success' ? text.success : text.failed}
        </p>
      </div>
    </main>
  )
}
