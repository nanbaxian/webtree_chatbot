import { ArrowUpRight, CheckCircle2, Quote, Sparkles } from 'lucide-react'

const citations = [
  {
    label: 'Knowledge base | Refund policy | Page 12',
    text: 'This answer was grounded in the refund policy and the latest service terms.',
  },
  {
    label: 'Product manual | Setup guide | Section 3',
    text: 'The retrieval layer also surfaced the installation steps from the product manual.',
  },
]

export default function KnowledgeChatDemo({ botId }: { botId: string }) {
  return (
    <main className="min-h-screen bg-[#0b0e13] px-6 py-8 text-white">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="rounded-[2rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.28em] text-amber-100/80">Bot demo</div>
          <h1 className="mt-3 text-2xl font-semibold">bot/{botId}</h1>
          <p className="mt-3 text-sm leading-7 text-white/60">
            This route is a public-facing chat shell for the PRD. Connect the Worker API and citations layer here next.
          </p>
          <div className="mt-6 space-y-3 text-sm text-white/70">
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">Multi-tenant prompt controls</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">Streamed answers and source cards</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">Public widget phase later</div>
          </div>
        </aside>

        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-amber-100/80">Live chat shell</div>
              <h2 className="mt-2 text-xl font-semibold">KnowledgeOS Assistant</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" />
              RAG ready
            </div>
          </div>

          <div className="space-y-4 py-5">
            <div className="max-w-2xl rounded-[1.5rem] rounded-bl-md border border-white/10 bg-white/6 px-4 py-4 text-sm leading-7 text-white/80">
              Hello. I found the answer in the knowledge base and attached the source hints below.
            </div>
            <div className="ml-auto max-w-2xl rounded-[1.5rem] rounded-br-md border border-amber-300/20 bg-amber-300 px-4 py-4 text-sm leading-7 text-slate-950">
              What is the official refund window for annual subscriptions?
            </div>
            <div className="max-w-2xl rounded-[1.5rem] rounded-bl-md border border-white/10 bg-white/6 px-4 py-4 text-sm leading-7 text-white/80">
              Annual subscriptions can be refunded within 14 days when the contract has not been materially consumed.
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-4">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45">Ask a question</label>
            <div className="mt-3 flex gap-3">
              <input
                value="How does source citation work?"
                readOnly
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
              />
              <button className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950">
                Send
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-[2rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.28em] text-amber-100/80">Citations</div>
          <div className="mt-4 space-y-3">
            {citations.map(item => (
              <article key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-start gap-2 text-sm font-medium text-white">
                  <Quote className="mt-0.5 h-4 w-4 text-amber-100" />
                  <span>{item.label}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-white/65">{item.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            <CheckCircle2 className="mb-2 h-4 w-4" />
            Keep this route connected to the Worker once the API layer is rebuilt.
          </div>
        </aside>
      </div>
    </main>
  )
}
