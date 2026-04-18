'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, BarChart3, Bot, CircleDollarSign, Database, FileText, LayoutDashboard, Users } from 'lucide-react'
import type {
  Conversation,
  DataSource,
  KnowledgeBot,
  RetrievalLog,
  Tenant,
  TenantMember,
  UsageLog,
  KnowledgeDocument,
} from '@/types'

type Section = 'overview' | 'sources' | 'bots' | 'conversations' | 'usage' | 'members' | 'embed'

type DashboardData = {
  tenant: Tenant | null
  bots: KnowledgeBot[]
  sources: DataSource[]
  documents: KnowledgeDocument[]
  conversations: Conversation[]
  members: TenantMember[]
  usage: UsageLog[]
  retrievalLogs: RetrievalLog[]
}

const navItems: { key: Section; label: string; href: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { key: 'sources', label: 'Sources', href: '/dashboard/sources', icon: Database },
  { key: 'bots', label: 'Bots', href: '/dashboard/bots', icon: Bot },
  { key: 'conversations', label: 'Conversations', href: '/dashboard/conversations', icon: FileText },
  { key: 'usage', label: 'Usage', href: '/dashboard/usage', icon: BarChart3 },
  { key: 'members', label: 'Members', href: '/dashboard/members', icon: Users },
  { key: 'embed', label: 'Embed', href: '/dashboard/embed', icon: CircleDollarSign },
]

const initialData: DashboardData = {
  tenant: null,
  bots: [],
  sources: [],
  documents: [],
  conversations: [],
  members: [],
  usage: [],
  retrievalLogs: [],
}

function getTenantId(): string {
  if (typeof window === 'undefined') return 'tenant_demo'
  const params = new URLSearchParams(window.location.search)
  return params.get('tenant_id') || window.localStorage.getItem('knowledgeos_tenant_id') || 'tenant_demo'
}

async function fetchJson<T>(path: string, tenantId: string): Promise<T> {
  const res = await fetch(path, {
    headers: { 'X-Tenant-Id': tenantId },
  })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json() as Promise<T>
}

export default function KnowledgeOSDashboard({ section }: { section: Section }) {
  const [tenantId, setTenantId] = useState('tenant_demo')
  const [data, setData] = useState<DashboardData>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = getTenantId()
    setTenantId(id)
    window.localStorage.setItem('knowledgeos_tenant_id', id)

    let active = true
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [tenant, bots, sources, documents, conversations, members, usage, retrievalLogs] = await Promise.all([
          fetchJson<Tenant>('/api/tenant', id),
          fetchJson<KnowledgeBot[]>('/api/bots', id),
          fetchJson<DataSource[]>('/api/sources', id),
          fetchJson<KnowledgeDocument[]>('/api/documents', id),
          fetchJson<Conversation[]>('/api/conversations', id),
          fetchJson<TenantMember[]>('/api/members', id),
          fetchJson<UsageLog[]>('/api/usage', id),
          fetchJson<RetrievalLog[]>('/api/retrieval-logs', id),
        ])
        if (!active) return
        setData({ tenant, bots, sources, documents, conversations, members, usage, retrievalLogs })
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        setData(initialData)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const title = {
    overview: 'Workspace overview',
    sources: 'Knowledge sources',
    bots: 'Bot configuration',
    conversations: 'Conversation audit',
    usage: 'Usage and billing',
    members: 'Members and access',
    embed: 'Embed and API',
  }[section]

  const tenantName = data.tenant?.name || 'KnowledgeOS Demo Tenant'
  const activeBots = data.bots.length
  const liveSources = data.sources.filter(source => source.status === 'ready' || source.status === 'completed').length
  const docCount = data.documents.filter(doc => !doc.deleted_at).length
  const conversationCount = data.conversations.length
  const usageTokens = data.usage.reduce((sum, row) => sum + row.input_tokens + row.output_tokens, 0)
  const latestRetrieval = data.retrievalLogs[0]

  const usageBars = useMemo(() => {
    const latest = data.usage[0]
    return [
      { label: 'Input tokens', value: latest?.input_tokens ?? 0, width: Math.min(100, ((latest?.input_tokens ?? 0) / 100000) * 100) },
      { label: 'Output tokens', value: latest?.output_tokens ?? 0, width: Math.min(100, ((latest?.output_tokens ?? 0) / 50000) * 100) },
      { label: 'Queries', value: latest?.queries_count ?? 0, width: Math.min(100, ((latest?.queries_count ?? 0) / 1000) * 100) },
    ]
  }, [data.usage])

  return (
    <main className="min-h-screen bg-[#0b0e13] text-white">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-white/3 px-5 py-6 lg:border-b-0 lg:border-r lg:border-white/10">
          <div className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
            <div className="text-xs uppercase tracking-[0.34em] text-amber-100/80">KnowledgeOS</div>
            <div className="mt-2 text-lg font-semibold">{tenantName}</div>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Tenant-aware controls for sources, bots, conversations, and usage.
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-xs text-white/60">
              tenant_id: {tenantId}
            </div>
          </div>
          <nav className="mt-6 space-y-2">
            {navItems.map(item => {
              const Icon = item.icon
              const active = item.key === section
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    active ? 'bg-white text-slate-950' : 'text-white/70 hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        <section className="px-5 py-6 lg:px-8">
          <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-amber-100/80">Dashboard</div>
              <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
              <p className="mt-2 text-sm text-white/55">
                {loading ? 'Loading live data from D1...' : error ? 'Showing the shell while data is unavailable.' : 'Live data from Cloudflare D1.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/65">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">Pages online</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Workers ready</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">D1 connected</span>
            </div>
          </header>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {section === 'overview' && (
            <div className="mt-6 grid gap-4 xl:grid-cols-4">
              {[
                ['Tenants', data.tenant ? '1' : '0'],
                ['Bots', String(activeBots)],
                ['Indexed docs', String(docCount)],
                ['Conversations', String(conversationCount)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                  <div className="text-xs uppercase tracking-[0.24em] text-white/45">{label}</div>
                  <div className="mt-4 text-3xl font-semibold text-amber-100">{value}</div>
                </div>
              ))}
            </div>
          )}

          {section === 'overview' && (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Usage tokens</div>
                <div className="mt-4 text-3xl font-semibold text-amber-100">{usageTokens.toLocaleString()}</div>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Ready sources</div>
                <div className="mt-4 text-3xl font-semibold text-amber-100">{liveSources}</div>
              </div>
            </div>
          )}

          {section === 'sources' && (
            <div className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 backdrop-blur-xl">
              <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr] border-b border-white/10 px-5 py-4 text-xs uppercase tracking-[0.24em] text-white/45">
                <span>Name</span>
                <span>Type</span>
                <span>Status</span>
                <span>Updated</span>
              </div>
              {data.sources.length === 0 ? (
                <div className="px-5 py-6 text-sm text-white/55">No sources yet.</div>
              ) : (
                data.sources.map(item => (
                  <div key={item.id} className="grid grid-cols-[1.8fr_1fr_1fr_1fr] border-b border-white/6 px-5 py-4 text-sm last:border-b-0">
                    <span className="font-medium text-white">{item.name}</span>
                    <span className="text-white/65">{item.type}</span>
                    <span className="text-amber-100">{item.status}</span>
                    <span className="text-white/65">{item.updated_at || item.created_at}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {section === 'bots' && (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {data.bots.length === 0 ? (
                <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl text-sm text-white/55">
                  No bots yet.
                </div>
              ) : (
                data.bots.map(bot => (
                  <article key={bot.id} className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">{bot.name}</h2>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{bot.language}</span>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-white/65">{bot.persona}</p>
                    <p className="mt-3 text-sm text-white/45">{bot.tone}</p>
                  </article>
                ))
              )}
            </div>
          )}

          {section === 'conversations' && (
            <div className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 backdrop-blur-xl">
              <div className="grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr] border-b border-white/10 px-5 py-4 text-xs uppercase tracking-[0.24em] text-white/45">
                <span>Updated</span>
                <span>Title</span>
                <span>Bot</span>
                <span>Channel</span>
                <span>Created by</span>
              </div>
              {data.conversations.length === 0 ? (
                <div className="px-5 py-6 text-sm text-white/55">No conversations yet.</div>
              ) : (
                data.conversations.map(conv => (
                  <div key={conv.id} className="grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr] border-b border-white/6 px-5 py-4 text-sm last:border-b-0">
                    <span className="text-white/75">{conv.updated_at}</span>
                    <span className="font-medium text-white">{conv.title}</span>
                    <span className="text-white/65">{conv.bot_id}</span>
                    <span className="text-white/65">{conv.channel}</span>
                    <span className="text-white/65">{conv.created_by || 'system'}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {section === 'usage' && (
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">This month</div>
                <div className="mt-4 space-y-4">
                  {usageBars.map(item => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.label}</span>
                        <span className="text-white/65">{item.value.toLocaleString()}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/10">
                        <div className="h-2 rounded-full bg-amber-300" style={{ width: `${Math.max(6, item.width)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Billing posture</div>
                <p className="mt-4 text-sm leading-7 text-white/65">
                  Token usage, document counts, and retrieval quality are now routed through the D1 metadata layer.
                </p>
                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-white/70">
                  Last tracked retrieval latency: {latestRetrieval ? `${latestRetrieval.latency_ms} ms` : 'n/a'}
                </div>
              </div>
            </div>
          )}

          {section === 'members' && (
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Members</div>
                <div className="mt-4 space-y-3 text-sm">
                  {data.members.length === 0 ? (
                    <div className="text-white/55">No members yet.</div>
                  ) : (
                    data.members.map(member => (
                      <div key={`${member.tenant_id}:${member.user_id}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                        <span>{member.user_id}</span>
                        <span className="text-white/60">{member.role}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Invite flow</div>
                <p className="mt-4 text-sm leading-7 text-white/65">
                  Invite new members by email, assign roles, and keep tenant-scoped access controlled from the start.
                </p>
                <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950">
                  Send invite
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {section === 'embed' && (
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Widget snippet</div>
                <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs leading-6 text-amber-100">
{`<script
  src="https://cdn.knowledgeos.ai/widget.js"
  data-bot-id="${data.bots[0]?.id || 'bot_01'}"
  data-tenant="${tenantId}"
></script>`}
                </pre>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Endpoints</div>
                <ul className="mt-4 space-y-3 text-sm text-white/70">
                  <li>/api/chat</li>
                  <li>/api/sources/upload</li>
                  <li>/api/conversations/:id/export</li>
                  <li>/api/retrieval-logs</li>
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
