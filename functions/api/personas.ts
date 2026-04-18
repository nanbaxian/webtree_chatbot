import type { Persona } from '../../types/index'
import { createApiLogger } from '../../lib/api-log'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sb(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

export const onRequestOptions = (): Response => new Response(null, { headers: cors })

export const onRequestGet: PagesFunction<Env> = async ctx => {
  const { env } = ctx
  const log = createApiLogger('personas:get', ctx)
  log.start()
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/personas?order=created_at.asc`, {
      headers: sb(env.SUPABASE_SERVICE_KEY),
    })
    if (!res.ok) {
      log.fail('supabase list failed', { stage: 'db', status: res.status })
      return json([] as Persona[])
    }
    const rows = (await res.json()) as Persona[]
    log.ok({ count: rows.length })
    return json(rows)
  } catch (e) {
    log.fail(e)
    return json([] as Persona[])
  }
}

export const onRequestPost: PagesFunction<Env> = async ctx => {
  const { request, env } = ctx
  const log = createApiLogger('personas:post', ctx)
  log.start()
  try {
    const body = (await request.json()) as Partial<Persona>
    const { name, name_en, avatar, prompt, prompt_en, reply_style } = body

    if (!name?.trim()) {
      log.fail('name required', { stage: 'validate' })
      return json({ error: '名字不能为空' }, 400)
    }
    if (prompt && prompt.length > 1000) {
      log.fail('prompt too long', { stage: 'validate' })
      return json({ error: '人设描述不能超过1000字' }, 400)
    }
    if (prompt_en && prompt_en.length > 1000) {
      log.fail('prompt_en too long', { stage: 'validate' })
      return json({ error: 'English persona prompt must be 1000 characters or fewer' }, 400)
    }

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/personas`, {
      method: 'POST',
      headers: sb(env.SUPABASE_SERVICE_KEY),
      body: JSON.stringify({
        name,
        name_en: name_en?.trim() || null,
        avatar: avatar ?? '🌸',
        prompt,
        prompt_en: prompt_en?.trim() || null,
        reply_style: reply_style ?? 'medium',
      }),
    })
    if (!res.ok) {
      log.fail('supabase create failed', { stage: 'db', status: res.status })
      return json({ error: '创建失败' }, 500)
    }
    const rows = (await res.json()) as Persona[]
    if (!rows[0]) {
      log.fail('empty create response', { stage: 'db' })
      return json({ error: '创建失败' }, 500)
    }
    log.ok({ personaId: rows[0].id })
    return json(rows[0])
  } catch (e) {
    log.fail(e)
    return json({ error: '创建失败' }, 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async ctx => {
  const { request, env } = ctx
  const log = createApiLogger('personas:delete', ctx)
  log.start()
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      log.fail('id required', { stage: 'validate' })
      return json({ error: 'id 不能为空' }, 400)
    }

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/personas?id=eq.${id}`, {
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
