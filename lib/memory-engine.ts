// lib/memory-engine.ts
// Workers Runtime — 从 @/types 导入，消除重复定义

import type { DbMessage, CoreMemory, MemorySnapshot, MemoryContext } from '../types/index'

// 重新导出，方便其他 lib 文件引用
export type { DbMessage as Message, CoreMemory, MemorySnapshot, MemoryContext }

// ================================================
// Supabase REST 轻客户端（纯 fetch，Workers 兼容）
// ================================================
class SupabaseRest {
  constructor(private url: string, private key: string) {}

  private get h() {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }
  }

  async select<T>(table: string, params: Record<string, string> = {}): Promise<T[]> {
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`${this.url}/rest/v1/${table}${qs ? '?' + qs : ''}`, { headers: this.h })
    if (!res.ok) throw new Error(`select ${table}: ${await res.text()}`)
    return res.json()
  }

  async insert<T>(table: string, data: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST', headers: this.h, body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`insert ${table}: ${await res.text()}`)
    const rows: T[] = await res.json()
    return rows[0]
  }

  async patch(table: string, matchKey: string, matchVal: string, data: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/${table}?${matchKey}=eq.${matchVal}`, {
      method: 'PATCH', headers: this.h, body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`patch ${table}: ${await res.text()}`)
  }

  async delete(table: string, matchKey: string, matchVal: string): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/${table}?${matchKey}=eq.${matchVal}`, {
      method: 'DELETE', headers: this.h,
    })
    if (!res.ok) throw new Error(`delete ${table}: ${await res.text()}`)
  }

  async batchPatch(table: string, ids: string[], data: Record<string, unknown>): Promise<void> {
    if (!ids.length) return
    const inList = ids.join(',')
    const res = await fetch(`${this.url}/rest/v1/${table}?id=in.(${inList})`, {
      method: 'PATCH', headers: this.h, body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`batchPatch ${table}: ${await res.text()}`)
  }

  async batchDelete(table: string, ids: string[]): Promise<void> {
    if (!ids.length) return
    const inList = ids.join(',')
    const res = await fetch(`${this.url}/rest/v1/${table}?id=in.(${inList})`, {
      method: 'DELETE', headers: this.h,
    })
    if (!res.ok) throw new Error(`batchDelete ${table}: ${await res.text()}`)
  }

  async rpc<T>(fn: string, params: Record<string, unknown>): Promise<T[]> {
    const res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: this.h, body: JSON.stringify(params),
    })
    if (!res.ok) throw new Error(`rpc ${fn}: ${await res.text()}`)
    return res.json()
  }
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}
function hoursAgo(n: number) {
  return new Date(Date.now() - n * 3_600_000).toISOString()
}

function parseSnap(s: Record<string, unknown>): MemorySnapshot {
  return {
    ...(s as unknown as MemorySnapshot),
    key_facts: Array.isArray(s['key_facts'])
      ? (s['key_facts'] as string[])
      : (typeof s['key_facts'] === 'string' ? JSON.parse((s['key_facts'] as string) || '[]') : []),
  }
}

// ================================================
// 生成向量嵌入
// 优先：Cloudflare Workers AI binding（@cf/baai/bge-m3，1024维，60k tokens）
//   → env.AI.run() 走内部 binding，无网络请求，无地区封锁问题
// 降级：本地开发无 AI binding 时，使用轻量的“伪 embedding”（1024维）
//   → 只用于本地联调，避免与你的数据库维度不一致（生产务必使用 bge-m3）
// ================================================
export async function generateEmbedding(
  geminiApiKey: string,
  text: string,
  cfAi?: Ai,
): Promise<number[]> {
  // 优先走 Workers AI binding（生产环境）
  if (cfAi) {
    const result = await cfAi.run('@cf/baai/bge-m3', { text, truncate_inputs: true })
    // bge-m3 返回 { shape: [1, 1024], data: [[...1024 floats]] }
    const vec = (result as unknown as { data: number[][] }).data?.[0]
    if (!vec || vec.length !== 1024) throw new Error('bge-m3 embedding: unexpected output shape')
    return vec
  }

  // 本地开发降级：生成 1024 维伪向量（不需要外网）
  // 注意：此向量不具备真实语义，仅保证“可跑通”和维度一致。
  // 生产环境请务必通过 Workers AI 的 bge-m3。
  return pseudoEmbedding1024(text)
}

// 生成稳定的 1024 维伪 embedding：
// - 纯前端/Workers 可运行
// - 同一输入稳定输出
// - 结果做 L2 normalize，避免余弦计算异常
function pseudoEmbedding1024(text: string): number[] {
  const dim = 1024
  const v = new Array(dim).fill(0)

  // 简单 FNV-1a hash
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  // 线性同余生成器填充
  let x = h >>> 0
  for (let i = 0; i < dim; i++) {
    x = (Math.imul(1664525, x) + 1013904223) >>> 0
    // [-1, 1]
    v[i] = (x / 0xffffffff) * 2 - 1
  }

  // L2 normalize
  let sumSq = 0
  for (let i = 0; i < dim; i++) sumSq += v[i] * v[i]
  const inv = sumSq > 0 ? 1 / Math.sqrt(sumSq) : 1
  for (let i = 0; i < dim; i++) v[i] *= inv
  return v
}

// ================================================
// 读取记忆上下文
// ================================================
export async function loadMemoryContext(
  supabaseUrl: string,
  supabaseKey: string,
  currentQuery?: string,
  geminiApiKey?: string,
  personaId?: string,
  cfAi?: Ai,
): Promise<MemoryContext> {
  const db          = new SupabaseRest(supabaseUrl, supabaseKey)
  const shortCutoff = hoursAgo(12)
  const midCutoff   = daysAgo(30)

  // 短期消息过滤：若有 personaId，只取该人设的消息
  const shortMsgParams: Record<string, string> = {
    select: 'id,role,content,content_type,image_url,created_at',
    'created_at': `gte.${shortCutoff}`,
    // Fetch latest N then reorder to chronological before returning.
    order: 'created_at.desc',
    limit: '8',
  }
  if (personaId) shortMsgParams['persona_id'] = `eq.${personaId}`

  const [core, snapshots, shorts] = await Promise.all([
    db.select<CoreMemory>('core_memories', {
      select: 'id,fact,category,importance,created_at',
      order: 'importance.desc',
      limit: '15',
    }),
    db.select<Record<string, unknown>>('memory_snapshots', {
      select: 'id,tier,summary_text,key_facts,emotional_tone,clarity_score,period_start,period_end',
      order: 'period_end.desc',
      limit: '8',
    }),
    db.select<DbMessage>('messages', shortMsgParams),
  ])

  const parsedSnaps = snapshots.map(parseSnap)

  let semanticMatches: MemorySnapshot[] = []
  if (currentQuery && geminiApiKey) {
    try {
      const embedding = await generateEmbedding(geminiApiKey, currentQuery, cfAi)
      const raw = await db.rpc<Record<string, unknown>>('match_memories', {
        query_embedding: embedding,
        match_count: 3,
      })
      semanticMatches = raw.map(parseSnap)
    } catch (e) {
      console.error('[semantic search]', e)
    }
  }

  const shortTermMessages = [...shorts].reverse()

  return {
    coreMemories:      core,
    midTermSummary:    parsedSnaps.filter(s => s.tier === 'mid' && s.period_end >= midCutoff),
    longTermFragments: parsedSnaps.filter(s => s.tier === 'long'),
    shortTermMessages,
    semanticMatches,
  }
}

// ================================================
// 保存消息
// ================================================
export async function saveMessage(
  supabaseUrl: string,
  supabaseKey: string,
  role: 'user' | 'assistant',
  content: string,
  opts: { content_type?: string; image_url?: string; persona_id?: string; session_id?: string } = {}
): Promise<void> {
  const db = new SupabaseRest(supabaseUrl, supabaseKey)
  await db.insert('messages', {
    role,
    content,
    content_type: opts.content_type ?? 'text',
    image_url:    opts.image_url ?? null,
    memory_tier:  'short',
    ...(opts.persona_id ? { persona_id: opts.persona_id } : {}),
    ...(opts.session_id ? { session_id: opts.session_id } : {}),
  })
}

// ================================================
// 记忆压缩
// ================================================
export async function compressMemories(
  supabaseUrl: string,
  supabaseKey: string,
  geminiApiKey: string,
  cfAi?: Ai,
): Promise<void> {
  const db = new SupabaseRest(supabaseUrl, supabaseKey)
  // extractCoreMemories 必须在 compressShortToMid 之前执行
  // 原因：compressShortToMid 会把 memory_tier 改为 mid，
  //       之后 extractCoreMemories 查 short 消息就查不到了
  await extractCoreMemories(db, daysAgo(3), geminiApiKey)
  await compressShortToMid(db, daysAgo(3), geminiApiKey, cfAi)
  await compressMidToLong(db, daysAgo(30), geminiApiKey, cfAi)
}

async function compressShortToMid(db: SupabaseRest, cutoff: string, apiKey: string, cfAi?: Ai) {
  const old = await db.select<DbMessage>('messages', {
    'created_at': `lt.${cutoff}`,
    memory_tier: 'eq.short',
    order: 'created_at.asc',
    limit: '200',
  })
  if (!old.length) return

  for (let i = 0; i < old.length; i += 50) {
    const chunk = old.slice(i, i + 50)
    const conv  = chunk.map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).join('\n')
    const text  = await callGemini(apiKey,
      `将以下对话压缩为记忆摘要（200字以内）。保留情感状态、重要事件、偏好、关系。用第三人称描述用户。\n\n${conv}\n\nSUMMARY: [摘要]\nFACTS: ["事实1","事实2"]\nTONE: [情绪]`)

    const { summary, facts, tone } = parseCompression(text)

    let embeddingStr: string | undefined
    try {
      const vec = await generateEmbedding(apiKey, summary, cfAi)
      embeddingStr = `[${vec.join(',')}]`
    } catch {}

    await db.insert('memory_snapshots', {
      tier: 'mid', summary_text: summary, key_facts: facts,
      emotional_tone: tone, clarity_score: 0.7,
      period_start: chunk[0].created_at,
      period_end:   chunk[chunk.length - 1].created_at,
      ...(embeddingStr ? { embedding: embeddingStr } : {}),
    })

    await db.batchPatch('messages', chunk.map(m => m.id), { memory_tier: 'mid' })
  }
}

async function compressMidToLong(db: SupabaseRest, cutoff: string, apiKey: string, cfAi?: Ai) {
  // 明确 select 字段，排除 embedding（768维向量，每条约6KB），避免无意义的大数据传输
  const old = await db.select<Record<string, unknown>>('memory_snapshots', {
    select: 'id,tier,summary_text,key_facts,emotional_tone,clarity_score,period_start,period_end',
    tier: 'eq.mid', period_end: `lt.${cutoff}`, limit: '50',
  })
  if (!old.length) return

  const allText = old.map(s => s['summary_text'] as string).join('\n\n')
  const text    = await callGemini(apiKey,
    `将以下记忆压缩为零散长期碎片（100字以内）。用模糊语气（好像、似乎）。\n\n${allText}\n\nSUMMARY: [碎片]\nFACTS: ["碎片1"]\nTONE: [情绪]`)

  const { summary, facts, tone } = parseCompression(text)

  let embeddingStr: string | undefined
  try {
    const vec = await generateEmbedding(apiKey, summary, cfAi)
    embeddingStr = `[${vec.join(',')}]`
  } catch {}

  await db.insert('memory_snapshots', {
    tier: 'long', summary_text: summary, key_facts: facts,
    emotional_tone: tone, clarity_score: 0.25,
    period_start: old[0]['period_start'] as string,
    period_end:   old[old.length - 1]['period_end'] as string,
    ...(embeddingStr ? { embedding: embeddingStr } : {}),
  })

  await db.batchDelete('memory_snapshots', old.map(s => s['id'] as string))
}

async function extractCoreMemories(db: SupabaseRest, cutoff: string, apiKey: string) {
  const recent = await db.select<DbMessage>('messages', {
    'created_at': `lt.${cutoff}`,
    memory_tier: 'eq.short',
    order: 'created_at.asc',
    limit: '100',
  })
  if (!recent.length) return

  const conv = recent.map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).join('\n')
  const text = await callGemini(apiKey,
    `从对话中提取值得永久记住的核心事实（姓名、重要偏好、关键关系、重大事件）。不要提取闲聊。\n\n${conv}\n\n只返回JSON数组，无内容则返回[]：\n[{"fact":"...","category":"preference","importance":8}]`)

  try {
    const match = text.match(/\[[\s\S]*\]/)
    const arr = JSON.parse(match ? match[0] : '[]') as Array<{ fact: string; category: string; importance: number }>
    for (const f of arr) {
      if ((f.importance ?? 0) >= 6) {
        await db.insert('core_memories', {
          fact: f.fact, category: f.category ?? 'general',
          importance: f.importance, source_date: new Date().toISOString(),
        })
      }
    }
  } catch {}
}

// ================================================
// 工具
// ================================================
async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const startedAt = Date.now()
  const reqId = Math.random().toString(36).slice(2, 10)
  console.log(`[memory:deepinfra ${reqId}] start prompt_chars=${prompt.length}`)
  const url = 'https://api.deepinfra.com/v1/openai/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.2-3B-Instruct',
      temperature: 0.2,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  console.log(
    `[memory:deepinfra ${reqId}] upstream status=${res.status} ok=${res.ok} ` +
    `latency_ms=${Date.now() - startedAt}`
  )
  if (!res.ok) {
    const err = await res.text()
    console.error(`[memory:deepinfra ${reqId}] upstream error body=${err.slice(0, 600)}`)
    throw new Error(`DeepInfra ${res.status}: ${err}`)
  }
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  const text = data?.choices?.[0]?.message?.content ?? ''
  console.log(`[memory:deepinfra ${reqId}] done output_chars=${text.length}`)
  return text
}

function parseCompression(text: string) {
  // ES2018 /s flag — tsconfig target ES2018 后支持
  const summaryMatch = text.match(/SUMMARY:\s*(.+?)(?=\nFACTS:|$)/s)
  const summary  = summaryMatch?.[1]?.trim() ?? text.slice(0, 200)
  const factsRaw = text.match(/FACTS:\s*(\[[\s\S]*?\])/)?.[1] ?? '[]'
  const tone     = text.match(/TONE:\s*(.+?)(?=\n|$)/)?.[1]?.trim() ?? '平静'
  let facts: string[] = []
  try { facts = JSON.parse(factsRaw) } catch {}
  return { summary, facts, tone }
}
