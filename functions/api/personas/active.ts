// functions/api/personas/active.ts
// GET /api/personas/active  PUT /api/personas/active

import type { Persona } from '../../../types/index'
import { createApiLogger } from '../../../lib/api-log'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

interface AppSetting { key: string; value: unknown }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sb(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

export const onRequestOptions = (): Response => new Response(null, { headers: cors })

async function getActivePersonaId(supabaseUrl: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/app_settings?key=eq.active_persona_id`, { headers: sb(key) })
    if (!res.ok) return null
    const [row] = await res.json() as AppSetting[]
    if (!row) return null
    const val = row.value
    if (typeof val === 'string') {
      try { return JSON.parse(val) } catch { return val }
    }
    return String(val)
  } catch {
    return null
  }
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env } = ctx
  const log = createApiLogger('personas:active:get', ctx)
  log.start()
  try {
    const personaId = await getActivePersonaId(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

    if (!personaId) {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/personas?limit=1`, { headers: sb(env.SUPABASE_SERVICE_KEY) })
      const [p] = await res.json() as Persona[]
      log.ok({ source: 'fallback', hasPersona: Boolean(p) })
      return json(p ?? null)
    }

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/personas?id=eq.${personaId}&limit=1`, { headers: sb(env.SUPABASE_SERVICE_KEY) })
    const [persona] = await res.json() as Persona[]
    if (!persona) {
      const fallback = await fetch(`${env.SUPABASE_URL}/rest/v1/personas?limit=1`, { headers: sb(env.SUPABASE_SERVICE_KEY) })
      const [p] = await fallback.json() as Persona[]
      log.ok({ source: 'fallback-deleted', hasPersona: Boolean(p), personaId })
      return json(p ?? null)
    }
    log.ok({ personaId: persona.id })
    return json(persona)
  } catch (e) {
    log.fail(e)
    return json({ error: '读取失败' }, 500)
  }
}

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  const log = createApiLogger('personas:active:put', ctx)
  log.start()
  try {
    const body = await request.json() as { persona_id?: string }
    if (!body.persona_id) {
      log.fail('persona_id required', { stage: 'validate' })
      return json({ error: 'persona_id 不能为空' }, 400)
    }

    const existing = await getActivePersonaId(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
    const value = JSON.stringify(body.persona_id)

    if (existing !== null) {
      const patchRes = await fetch(`${env.SUPABASE_URL}/rest/v1/app_settings?key=eq.active_persona_id`, {
        method: 'PATCH',
        headers: sb(env.SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ value, updated_at: new Date().toISOString() }),
      })
      if (!patchRes.ok) {
        log.fail('patch active persona failed', { stage: 'db', status: patchRes.status })
        return json({ error: '更新失败' }, 500)
      }
    } else {
      const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/app_settings`, {
        method: 'POST',
        headers: sb(env.SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ key: 'active_persona_id', value, updated_at: new Date().toISOString() }),
      })
      if (!insertRes.ok) {
        log.fail('insert active persona failed', { stage: 'db', status: insertRes.status })
        return json({ error: '写入失败' }, 500)
      }
    }
    log.ok({ personaId: body.persona_id })
    return json({ success: true })
  } catch (e) {
    log.fail(e)
    return json({ error: '更新失败' }, 500)
  }
}

