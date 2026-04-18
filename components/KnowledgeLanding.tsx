import Link from 'next/link'
import { ArrowRight, CheckCircle2, Database, FileText, LayoutDashboard, ShieldCheck, Sparkles } from 'lucide-react'

type Locale = 'en' | 'zh'

type Copy = {
  badge: string
  nav: { product: string; architecture: string; pricing: string; roadmap: string }
  hero: {
    eyebrow: string
    title: string
    subtitle: string
    primary: string
    secondary: string
    note: string
  }
  stats: { label: string; value: string }[]
  sections: {
    whyTitle: string
    whySubtitle: string
    roadmapTitle: string
    roadmapSubtitle: string
    pricingTitle: string
    pricingSubtitle: string
  }
}

const copy: Record<Locale, Copy> = {
  en: {
    badge: 'KnowledgeOS v1.0 - Enterprise RAG Knowledge Base SaaS',
    nav: {
      product: 'Product',
      architecture: 'Architecture',
      pricing: 'Pricing',
      roadmap: 'Roadmap',
    },
    hero: {
      eyebrow: 'Multi-tenant knowledge ops for SMB and enterprise teams',
      title: 'Ship a brand-safe knowledge chatbot that cites sources and keeps tenants isolated.',
      subtitle:
        'KnowledgeOS turns websites, PDFs, DOCX, and QA packs into an auditable knowledge layer with citations, conversation history, and RAG-ready retrieval.',
      primary: 'Open dashboard',
      secondary: 'View chat demo',
      note: 'Cloudflare Pages for the frontend, Workers for orchestration, R2 for files, and a rebuild-ready config surface for the Cloudflare account.',
    },
    stats: [
      { label: 'Tenant isolation', value: 'Hard-enforced' },
      { label: 'Knowledge sources', value: 'Website, PDF, DOCX, QA' },
      { label: 'Citations', value: 'Chunk level' },
      { label: 'Async pipeline', value: 'Queues ready' },
    ],
    sections: {
      whyTitle: 'Why this shape is better',
      whySubtitle:
        'The PRD is broader than a simple chatbot. This shell reflects the SaaS layers that matter before full backend completion.',
      roadmapTitle: 'Phase 1 scope',
      roadmapSubtitle:
        'The current repo can start with a convincing public site, auth entry points, dashboard shell, and route structure for later API work.',
      pricingTitle: 'Packaging',
      pricingSubtitle:
        'The pricing model from the PRD is preserved so sales, onboarding, and product language stay aligned.',
    },
  },
  zh: {
    badge: 'KnowledgeOS v1.0 - 企业知识库 RAG SaaS',
    nav: {
      product: '产品',
      architecture: '架构',
      pricing: '定价',
      roadmap: '路线图',
    },
    hero: {
      eyebrow: '面向 SMB 与企业团队的多租户知识运营平台',
      title: '搭建一个可追溯、可审计、支持引用来源的企业知识机器人。',
      subtitle:
        'KnowledgeOS 将官网、PDF、DOCX 和 QA 文档接入统一的知识层，支持引用溯源、会话历史和 RAG 检索链路。',
      primary: '打开控制台',
      secondary: '查看聊天演示',
      note: '前端使用 Cloudflare Pages，编排层使用 Workers，文件使用 R2，并保留可重建的 Cloudflare 配置入口。',
    },
    stats: [
      { label: '租户隔离', value: '强制校验' },
      { label: '知识源', value: '网站 / PDF / DOCX / QA' },
      { label: '引用来源', value: 'Chunk 级' },
      { label: '异步链路', value: '支持 Queue' },
    ],
    sections: {
      whyTitle: '为什么这样改更合理',
      whySubtitle:
        'PRD 不是单纯聊天机器人，而是 SaaS。这里先补齐产品外壳和关键路径，再逐步扩展后端能力。',
      roadmapTitle: '第一阶段范围',
      roadmapSubtitle:
        '当前仓库先落地可用的官网、登录入口、Dashboard 外壳和后续 API 的路由结构。',
      pricingTitle: '套餐设计',
      pricingSubtitle:
        '保留 PRD 中的套餐语义，方便销售、交付和产品文案保持一致。',
    },
  },
}

const featureCards = [
  {
    icon: ShieldCheck,
    title: 'Tenant isolation',
    text: 'Every record, document, and chat session is scoped to a tenant boundary.',
  },
  {
    icon: Database,
    title: 'Knowledge ingestion',
    text: 'Website crawl, PDF, DOCX, and QA packs feed the same retrieval layer.',
  },
  {
    icon: FileText,
    title: 'Citation-first replies',
    text: 'Each answer can surface source cards with page, section, and URL hints.',
  },
  {
    icon: LayoutDashboard,
    title: 'Operator dashboard',
    text: 'Track sources, bots, sessions, usage, and members from one console.',
  },
]

const pricingCards = [
  { name: 'Starter', price: '$49/mo', limit: '1 bot, 3 sources, 50MB', tone: 'for pilots' },
  { name: 'Growth', price: '$149/mo', limit: '5 bots, 20 sources, 500MB', tone: 'for small teams' },
  { name: 'Business', price: '$499/mo', limit: 'Unlimited bots, 5GB', tone: 'for operations' },
  { name: 'Enterprise', price: 'Custom', limit: 'Private deployment + SLA', tone: 'for regulated orgs' },
]

export default function KnowledgeLanding({ locale }: { locale: Locale }) {
  const c = copy[locale]

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,216,140,0.16),_transparent_32%),linear-gradient(180deg,#0e1116_0%,#11161d_44%,#0b0d11_100%)] text-white">
      <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_20%_10%,rgba(248,208,122,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.08),transparent_22%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 lg:px-10">
        <header className="mb-14 flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-xl">
          <div>
            <div className="text-[10px] uppercase tracking-[0.36em] text-amber-200/80">{c.badge}</div>
            <div className="mt-1 text-sm text-white/80">KnowledgeOS</div>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-white/75">
            <span>{c.nav.product}</span>
            <span>{c.nav.architecture}</span>
            <span>{c.nav.pricing}</span>
            <span>{c.nav.roadmap}</span>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/15">
              {c.hero.primary}
            </Link>
            <Link href="/chat/demo" className="rounded-full bg-amber-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-200">
              {c.hero.secondary}
            </Link>
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-amber-100">
              <Sparkles className="h-3.5 w-3.5" />
              {c.hero.eyebrow}
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {c.hero.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">{c.hero.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-amber-100">
                {c.hero.primary}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/chat/demo" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-white transition hover:bg-white/10">
                {c.hero.secondary}
              </Link>
            </div>
            <p className="mt-5 max-w-2xl text-sm text-white/55">{c.hero.note}</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <div className="grid gap-3 sm:grid-cols-2">
              {c.stats.map(stat => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="text-xs uppercase tracking-[0.26em] text-white/45">{stat.label}</div>
                  <div className="mt-3 text-2xl font-semibold text-amber-100">{stat.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2 text-sm text-amber-100">
                <CheckCircle2 className="h-4 w-4" />
                Multi-layer architecture
              </div>
              <div className="mt-4 grid gap-3 text-sm text-white/75">
                <div className="rounded-2xl bg-white/5 px-4 py-3">Pages frontend and marketing site</div>
                <div className="rounded-2xl bg-white/5 px-4 py-3">Workers API and orchestration layer</div>
                <div className="rounded-2xl bg-white/5 px-4 py-3">R2 files, queue consumers, and rebuild-ready settings</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map(card => {
            const Icon = card.icon
            return (
              <article key={card.title} className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-100">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">{card.title}</h2>
                <p className="mt-2 text-sm leading-7 text-white/65">{card.text}</p>
              </article>
            )
          })}
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/6 p-7 backdrop-blur-xl">
            <div className="text-sm uppercase tracking-[0.28em] text-amber-100/80">{c.sections.whyTitle}</div>
            <p className="mt-4 text-base leading-8 text-white/70">{c.sections.whySubtitle}</p>
            <div className="mt-8 space-y-4 text-sm text-white/70">
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">1. SaaS product language replaces companion-only copy.</div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">2. Cloudflare settings are rebuilt as explicit deployment state.</div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">3. Routes are scaffolded for auth, dashboard, chat, and embed flows.</div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {pricingCards.map(card => (
              <article key={card.name} className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
                <div className="text-sm text-amber-100/80">{card.tone}</div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <h3 className="text-2xl font-semibold text-white">{card.name}</h3>
                  <span className="text-lg text-white/70">{card.price}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-white/65">{card.limit}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-3">
          <article className="rounded-[2rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl lg:col-span-2">
            <div className="text-sm uppercase tracking-[0.28em] text-amber-100/80">{c.sections.roadmapTitle}</div>
            <p className="mt-4 text-base leading-8 text-white/70">{c.sections.roadmapSubtitle}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Phase 1</div>
                <div className="mt-2 text-sm text-white/80">Register, login, sources, bots, chat, citations</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Phase 2</div>
                <div className="mt-2 text-sm text-white/80">Website crawl, reindex, permissions, usage</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Phase 3</div>
                <div className="mt-2 text-sm text-white/80">Embed widget and public chat endpoint</div>
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
            <div className="text-sm uppercase tracking-[0.28em] text-amber-100/80">{c.sections.pricingTitle}</div>
            <p className="mt-4 text-base leading-8 text-white/70">{c.sections.pricingSubtitle}</p>
            <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-sm text-white/70">
              Starter, Growth, Business, and Enterprise remain the market-facing packaging.
            </div>
          </article>
        </section>

        <footer className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-8 text-sm text-white/45 md:flex-row md:items-center md:justify-between">
          <div>KnowledgeOS on Cloudflare Pages + Workers + R2</div>
          <div className="flex gap-4">
            <Link href="/auth/login" className="hover:text-white">
              Login
            </Link>
            <Link href="/auth/register" className="hover:text-white">
              Register
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
