import { createApiLogger } from '../../lib/api-log'
import { json, options } from './_knowledgeos-shared'
import { listDocuments, readTenantId, type D1Document, type D1Env, upsertDocument } from '../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:documents:get', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const rows = await listDocuments(ctx.env, tenantId)
  if (rows) {
    log.ok({ tenantId, count: rows.length })
    return json(rows)
  }
  log.ok({ tenantId, fallback: true })
  return json([])
}

export const onRequestPost: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:documents:post', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const body = await ctx.request.json().catch(() => ({})) as Partial<D1Document>
  const now = new Date().toISOString()
  const payload: D1Document = {
    id: String(body.id || `doc_${Date.now()}`),
    tenant_id: tenantId,
    source_id: body.source_id ?? null,
    title: String(body.title || 'Untitled document'),
    file_name: body.file_name ?? null,
    r2_key: body.r2_key ?? null,
    status: String(body.status || 'uploaded'),
    error_msg: body.error_msg ?? null,
    version: Number(body.version || 1),
    created_at: now,
    updated_at: now,
    deleted_at: body.deleted_at ?? null,
  }
  const row = await upsertDocument(ctx.env, payload)
  if (row) {
    log.ok({ tenantId, docId: row.id })
    return json(row, 201)
  }
  log.ok({ tenantId, fallback: true })
  return json(payload, 201)
}
