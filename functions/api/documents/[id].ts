import { createApiLogger } from '../../../lib/api-log'
import { json, options } from '../_knowledgeos-shared'
import { deleteDocument, getDocument, readTenantId, type D1Document, type D1Env, upsertDocument } from '../../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env, 'id'> = async ctx => {
  const log = createApiLogger('knowledgeos:documents:id:get', ctx)
  log.start()
  const documentId = ctx.params.id
  const row = await getDocument(ctx.env, documentId)
  if (row) return json(row)
  return json({ error: 'Document not found' }, 404)
}

export const onRequestPatch: PagesFunction<Env, 'id'> = async ctx => {
  const documentId = ctx.params.id
  const tenantId = readTenantId(ctx.request)
  const body = await ctx.request.json().catch(() => ({})) as Partial<D1Document>
  const now = new Date().toISOString()
  const payload: D1Document = {
    id: documentId,
    tenant_id: tenantId,
    source_id: body.source_id ?? null,
    title: body.title || 'Untitled document',
    file_name: body.file_name ?? null,
    r2_key: body.r2_key ?? null,
    status: body.status || 'uploaded',
    error_msg: body.error_msg ?? null,
    version: body.version || 1,
    created_at: body.created_at || now,
    updated_at: now,
    deleted_at: body.deleted_at ?? null,
  }
  const row = await upsertDocument(ctx.env, payload)
  return json(row ?? payload)
}

export const onRequestDelete: PagesFunction<Env, 'id'> = async ctx => {
  const ok = await deleteDocument(ctx.env, ctx.params.id)
  return ok ? json({ success: true }) : json({ success: false }, 404)
}
