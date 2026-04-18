import { createApiLogger } from '../../lib/api-log'
import { json, options } from './_knowledgeos-shared'
import { listSources, readTenantId, type D1Env, type D1Source, upsertSource } from '../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:sources:get', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const rows = await listSources(ctx.env, tenantId)
  if (rows) {
    log.ok({ tenantId, count: rows.length })
    return json(rows)
  }
  log.ok({ tenantId, fallback: true })
  return json([])
}

export const onRequestPost: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:sources:post', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const body = await ctx.request.json().catch(() => ({})) as Partial<D1Source> & { config_json?: unknown }
  const now = new Date().toISOString()
  const payload: D1Source = {
    id: String(body.id || `source_${Date.now()}`),
    tenant_id: tenantId,
    bot_id: body.bot_id ?? null,
    type: String(body.type || 'website'),
    name: String(body.name || 'New source'),
    config_json: typeof body.config_json === 'string' ? body.config_json : JSON.stringify(body.config_json ?? {}),
    status: String(body.status || 'draft'),
    created_at: now,
    updated_at: now,
  }
  const row = await upsertSource(ctx.env, payload)
  if (row) {
    log.ok({ tenantId, sourceId: row.id })
    return json(row, 201)
  }
  log.ok({ tenantId, fallback: true })
  return json(payload, 201)
}
