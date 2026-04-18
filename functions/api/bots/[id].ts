import { createApiLogger } from '../../../lib/api-log'
import { json, options } from '../_knowledgeos-shared'
import { deleteBot, getBot, readTenantId, type D1Bot, type D1Env, upsertBot } from '../../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env, 'id'> = async ctx => {
  const log = createApiLogger('knowledgeos:bots:id:get', ctx)
  log.start()
  const botId = ctx.params.id
  const row = await getBot(ctx.env, botId)
  if (row) {
    log.ok({ botId })
    return json(row)
  }
  log.ok({ botId, fallback: true })
  return json({ error: 'Bot not found' }, 404)
}

export const onRequestPatch: PagesFunction<Env, 'id'> = async ctx => {
  const log = createApiLogger('knowledgeos:bots:id:patch', ctx)
  log.start()
  const botId = ctx.params.id
  const tenantId = readTenantId(ctx.request)
  const body = await ctx.request.json().catch(() => ({})) as Partial<D1Bot> & { settings_json?: unknown }
  const now = new Date().toISOString()
  const payload: D1Bot = {
    id: botId,
    tenant_id: tenantId,
    name: body.name || 'KnowledgeOS Assistant',
    persona: body.persona || 'Professional and concise',
    tone: body.tone || 'concise',
    welcome_msg: body.welcome_msg || 'Hello, how can I help?',
    fallback_msg: body.fallback_msg || 'I could not find a matching source.',
    language: body.language || 'zh-CN',
    settings_json: typeof body.settings_json === 'string' ? body.settings_json : JSON.stringify(body.settings_json ?? {}),
    created_at: body.created_at || now,
    updated_at: now,
  }
  const row = await upsertBot(ctx.env, payload)
  if (row) {
    log.ok({ botId })
    return json(row)
  }
  log.ok({ botId, fallback: true })
  return json(payload)
}

export const onRequestDelete: PagesFunction<Env, 'id'> = async ctx => {
  const log = createApiLogger('knowledgeos:bots:id:delete', ctx)
  log.start()
  const botId = ctx.params.id
  const ok = await deleteBot(ctx.env, botId)
  if (ok) {
    log.ok({ botId })
    return json({ success: true })
  }
  log.ok({ botId, fallback: true })
  return json({ success: false }, 404)
}
