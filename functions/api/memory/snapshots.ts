// functions/api/memory/snapshots.ts
// GET /api/memory/snapshots  DELETE /api/memory/snapshots?id=xxx

import type { MemorySnapshot } from '../../../types/index'
import { createApiLogger } from '../../../lib/api-log'

interface Env { SUPABASE_URL: string; SUPABASE_SERVICE_KEY: string }

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

function sb(k: string): Record<string, string> {
  return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' }
}

function json(d: unknown, s = 200): Response {
  return new Response(JSON.stringify(d), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}

export const onRequestOptions = (): Response => new Response(null, { headers: cors })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env } = ctx
  const log = createApiLogger('memory:snapshots:get', ctx)
  log.start()
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/memory_snapshots?select=id,tier,summary_text,key_facts,emotional_tone,clarity_score,period_start,period_end&order=period_end.desc`,
      { headers: sb(env.SUPABASE_SERVICE_KEY) }
    )
    if (!res.ok) {
      log.fail('supabase list failed', { stage: 'db', status: res.status })
      return json([] as MemorySnapshot[])
    }
    const rows = await res.json() as MemorySnapshot[]
    log.ok({ count: rows.length })
    return json(rows)
  } catch (e) {
    log.fail(e)
    return json([] as MemorySnapshot[])
  }
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  const log = createApiLogger('memory:snapshots:delete', ctx)
  log.start()
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      log.fail('id required', { stage: 'validate' })
      return json({ error: 'id required' }, 400)
    }
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/memory_snapshots?id=eq.${id}`, {
      method: 'DELETE',
      headers: sb(env.SUPABASE_SERVICE_KEY),
    })
    if (!res.ok) {
      log.fail('supabase delete failed', { stage: 'db', status: res.status, id })
      return json({ error: '删除失败' }, 500)
    }
    log.ok({ id })
    return json({ success: true })
  } catch (e) {
    log.fail(e)
    return json({ error: '删除失败' }, 500)
  }
}

