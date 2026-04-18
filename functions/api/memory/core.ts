// functions/api/memory/core.ts
// GET /api/memory/core  DELETE /api/memory/core?id=xxx

import type { CoreMemory } from '../../../types/index'
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
  const log = createApiLogger('memory:core:get', ctx)
  log.start()
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/core_memories?order=importance.desc,created_at.desc`,
      { headers: sb(env.SUPABASE_SERVICE_KEY) }
    )
    if (!res.ok) {
      log.fail('supabase list failed', { stage: 'db', status: res.status })
      return json([] as CoreMemory[])
    }
    const rows = await res.json() as CoreMemory[]
    log.ok({ count: rows.length })
    return json(rows)
  } catch (e) {
    log.fail(e)
    return json([] as CoreMemory[])
  }
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  const log = createApiLogger('memory:core:delete', ctx)
  log.start()
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      log.fail('id required', { stage: 'validate' })
      return json({ error: 'id required' }, 400)
    }
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/core_memories?id=eq.${id}`, {
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

