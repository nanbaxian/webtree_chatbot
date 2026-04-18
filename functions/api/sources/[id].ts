import { createApiLogger } from '../../../lib/api-log'
import { json, options } from '../_knowledgeos-shared'
import { deleteSource, getSource, readTenantId, type D1Env, type D1Source, upsertSource } from '../../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env, 'id'> = async ctx => {
  const log = createApiLogger('knowledgeos:sources:id:get', ctx)
  log.start()
  const sourceId = ctx.params.id
  const row = await getSource(ctx.env, sourceId)
  if (row) {
    log.ok({ sourceId })
    return json(row)
  }
  return json({ error: 'Source not found' }, 404)
}

export const onRequestPatch: PagesFunction<Env, 'id'> = async ctx => {
  const log = createApiLogger('knowledgeos:sources:id:patch', ctx)
  log.start()
  const sourceId = ctx.params.id
  const tenantId = readTenantId(ctx.request)
  const body = await ctx.request.json().catch(() => ({})) as Partial<D1Source> & { config_json?: unknown }
  const now = new Date().toISOString()
  const payload: D1Source = {
    id: sourceId,
    tenant_id: tenantId,
    bot_id: body.bot_id ?? null,
    type: body.type || 'website',
    name: body.name || 'New source',
    config_json: typeof body.config_json === 'string' ? body.config_json : JSON.stringify(body.config_json ?? {}),
    status: body.status || 'draft',
    created_at: body.created_at || now,
    updated_at: now,
  }
  const row = await upsertSource(ctx.env, payload)
  if (row) return json(row)
  return json(payload)
}

export const onRequestDelete: PagesFunction<Env, 'id'> = async ctx => {
  const ok = await deleteSource(ctx.env, ctx.params.id)
  return ok ? json({ success: true }) : json({ success: false }, 404)
}
