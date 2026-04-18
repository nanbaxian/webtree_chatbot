'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

type Mode = 'login' | 'register'

export default function KnowledgeAuthPage({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const copy = useMemo(() => {
    if (mode === 'register') {
      return {
        title: 'Create your KnowledgeOS workspace',
        subtitle: 'Register a company account and receive a magic link to start onboarding.',
        cta: 'Send signup link',
      }
    }
    return {
      title: 'Sign in to KnowledgeOS',
      subtitle: 'Use Magic Link to access your tenant dashboard and knowledge tools.',
      cta: 'Send login link',
    }
  }, [mode])

  const sendMagicLink = async () => {
    if (!email.trim()) return
    setStatus('sending')
    try {
      const redirectBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      const callbackUrl = new URL('/auth/callback', redirectBase)
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: callbackUrl.toString(),
        },
      })
      if (error) throw error
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,216,140,0.16),_transparent_24%),linear-gradient(180deg,#0f1319_0%,#0b0d11_100%)] px-6 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-amber-100">
            <Mail className="h-3.5 w-3.5" />
            KnowledgeOS access
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-white/70">{copy.subtitle}</p>
          <div className="mt-8 space-y-3 text-sm text-white/70">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-amber-100" />
              Magic Link login remains the fastest path for early access.
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-amber-100" />
              Tenant creation, member invitations, and bot setup follow after sign in.
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 backdrop-blur-xl">
          <div className="text-sm uppercase tracking-[0.24em] text-amber-100/80">
            {mode === 'register' ? 'Register' : 'Login'}
          </div>
          <h2 className="mt-3 text-2xl font-semibold">{copy.title}</h2>
          <p className="mt-2 text-sm leading-7 text-white/60">{copy.subtitle}</p>

          <div className="mt-6">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45">Work email</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-amber-100/50"
            />
          </div>

          <button
            onClick={sendMagicLink}
            disabled={!email.trim() || status === 'sending'}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === 'sending' ? 'Sending...' : copy.cta}
          </button>

          {status === 'sent' && (
            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              Link sent. Check your inbox.
            </div>
          )}
          {status === 'error' && (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
              Send failed. Please retry.
            </div>
          )}

          <div className="mt-6 flex items-center justify-between text-sm text-white/55">
            <Link href="/dashboard" className="hover:text-white">
              Skip to dashboard shell
            </Link>
            <Link href="/chat/demo" className="hover:text-white">
              Open demo chat
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
