import { createApiLogger } from '../../lib/api-log'
import { json, options } from './_knowledgeos-shared'
import { listMembers, readTenantId, type D1Env, type D1Member, upsertMember } from '../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:members:get', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const rows = await listMembers(ctx.env, tenantId)
  if (rows) {
    log.ok({ tenantId, count: rows.length })
    return json(rows)
  }
  log.ok({ tenantId, fallback: true })
  return json([])
}

export const onRequestPost: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:members:post', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const body = await ctx.request.json().catch(() => ({})) as Partial<D1Member>
  const now = new Date().toISOString()
  const payload: D1Member = {
    tenant_id: tenantId,
    user_id: String(body.user_id || `user_${Date.now()}`),
    role: (body.role as D1Member['role']) || 'member',
    invited_at: body.invited_at ?? now,
    joined_at: body.joined_at ?? null,
    created_at: now,
    updated_at: now,
  }
  const row = await upsertMember(ctx.env, payload)
  if (row) {
    log.ok({ tenantId, userId: row.user_id })
    return json(row, 201)
  }
  log.ok({ tenantId, fallback: true })
  return json(payload, 201)
}
