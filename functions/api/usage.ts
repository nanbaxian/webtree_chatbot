import { createApiLogger } from '../../lib/api-log'
import { json, options } from './_knowledgeos-shared'
import { listUsage, readTenantId, type D1Env } from '../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:usage:get', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const rows = await listUsage(ctx.env, tenantId)
  if (rows) {
    log.ok({ tenantId, count: rows.length })
    return json(rows)
  }
  log.ok({ tenantId, fallback: true })
  return json([])
}
