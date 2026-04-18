import { createApiLogger } from '../../lib/api-log'
import { demoTenant, json, options } from './_knowledgeos-shared'
import { getTenant, readTenantId, tenantSeed, upsertTenant, type D1Env } from '../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:tenant:get', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const row = await getTenant(ctx.env, tenantId)
  if (row) {
    log.ok({ tenantId })
    return json(row)
  }
  if (ctx.env.DB) {
    const seeded = await upsertTenant(ctx.env, tenantSeed(tenantId))
    if (seeded) {
      log.ok({ tenantId, seeded: true })
      return json(seeded)
    }
  }
  log.ok({ tenantId, fallback: true })
  return json(demoTenant(tenantId))
}

export const onRequestPatch: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:tenant:patch', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const body = await ctx.request.json().catch(() => ({})) as Record<string, unknown>
  const tenant = {
    ...(tenantSeed(tenantId)),
    ...body,
    id: tenantId,
    updated_at: new Date().toISOString(),
  }
  const row = await upsertTenant(ctx.env, tenant)
  if (row) {
    log.ok({ tenantId })
    return json(row)
  }
  log.ok({ tenantId, fallback: true })
  return json(tenant)
}
