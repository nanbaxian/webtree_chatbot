import { createApiLogger } from '../../lib/api-log'
import { json, options } from './_knowledgeos-shared'
import { botSeed, listBots, readTenantId, type D1Bot, type D1Env, upsertBot } from '../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:bots:get', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const rows = await listBots(ctx.env, tenantId)
  if (rows) {
    log.ok({ tenantId, count: rows.length })
    return json(rows)
  }
  const fallback = [botSeed(tenantId)]
  log.ok({ tenantId, fallback: true })
  return json(fallback)
}

export const onRequestPost: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:bots:post', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const body = await ctx.request.json().catch(() => ({})) as Partial<D1Bot>
  const now = new Date().toISOString()
  const payload: D1Bot = {
    ...botSeed(tenantId),
    ...body,
    id: String(body.id || `bot_${Date.now()}`),
    tenant_id: tenantId,
    settings_json: typeof body.settings_json === 'string' ? body.settings_json : JSON.stringify(body.settings_json ?? {}),
    created_at: now,
    updated_at: now,
  }
  const row = await upsertBot(ctx.env, payload)
  if (row) {
    log.ok({ tenantId, botId: row.id })
    return json(row, 201)
  }
  log.ok({ tenantId, fallback: true })
  return json(payload, 201)
}
