// functions/api/memory/list.ts
// GET /api/memory/list -> 侧边栏三层记忆列表

import type { CoreMemory, MemorySnapshot, DbMessage } from '../../../types/index'
import { createApiLogger } from '../../../lib/api-log'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sb(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

export const onRequestOptions = (): Response => new Response(null, { headers: cors })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env } = ctx
  const log = createApiLogger('memory:list:get', ctx)
  log.start()
  try {
    const base = env.SUPABASE_URL
    const h = sb(env.SUPABASE_SERVICE_KEY)

    const settingRes = await fetch(`${base}/rest/v1/app_settings?key=eq.active_persona_id`, { headers: h })
    const [setting] = await settingRes.json() as Array<{ value: unknown }>
    let personaId: string | null = null
    if (setting?.value) {
      const v = setting.value
      personaId = typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return v } })() : String(v)
    }

    const shortFilter = personaId
      ? `role=eq.user&persona_id=eq.${personaId}&memory_tier=eq.short`
      : 'role=eq.user&memory_tier=eq.short'

    const [coreRes, snapRes, shortRes] = await Promise.all([
      fetch(`${base}/rest/v1/core_memories?select=id,fact,importance&order=importance.desc&limit=3`, { headers: h }),
      fetch(`${base}/rest/v1/memory_snapshots?select=id,tier,summary_text,key_facts&order=period_end.desc&limit=5`, { headers: h }),
      fetch(`${base}/rest/v1/messages?select=id,content&${shortFilter}&order=created_at.desc&limit=3`, { headers: h }),
    ])

    const core: CoreMemory[] = coreRes.ok ? await coreRes.json() : []
    const snaps: MemorySnapshot[] = snapRes.ok ? await snapRes.json() : []
    const shorts: DbMessage[] = shortRes.ok ? await shortRes.json() : []

    const result: Array<{ id: string; tier: string; content: string }> = []
    for (const m of core) result.push({ id: m.id, tier: 'core', content: m.fact })
    for (const m of shorts) {
      const preview = m.content.length > 40 ? `${m.content.slice(0, 40)}...` : m.content
      result.push({ id: m.id, tier: 'short', content: preview })
    }
    for (const s of snaps) {
      const facts: string[] = Array.isArray(s.key_facts) ? s.key_facts : []
      const content = facts[0] ?? s.summary_text?.slice(0, 50) ?? ''
      result.push({ id: s.id, tier: s.tier, content })
    }

    log.ok({ personaId, count: result.length })
    return new Response(JSON.stringify(result), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    log.fail(e)
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}

