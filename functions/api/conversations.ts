import { createApiLogger } from '../../lib/api-log'
import { json, options } from './_knowledgeos-shared'
import { conversationSeed, listConversations, readTenantId, type D1Conversation, type D1Env, upsertConversation } from '../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:conversations:get', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const rows = await listConversations(ctx.env, tenantId)
  if (rows) {
    log.ok({ tenantId, count: rows.length })
    return json(rows)
  }
  log.ok({ tenantId, fallback: true })
  return json([])
}

export const onRequestPost: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('knowledgeos:conversations:post', ctx)
  log.start()
  const tenantId = readTenantId(ctx.request)
  const body = await ctx.request.json().catch(() => ({})) as Partial<D1Conversation> & { bot_id?: string }
  const now = new Date().toISOString()
  const payload: D1Conversation = {
    id: String(body.id || `conv_${Date.now()}`),
    tenant_id: tenantId,
    bot_id: body.bot_id ? String(body.bot_id) : 'bot_demo',
    created_by: body.created_by ?? null,
    title: String(body.title || 'New conversation'),
    channel: String(body.channel || 'dashboard'),
    created_at: now,
    updated_at: now,
  }
  const row = await upsertConversation(ctx.env, payload)
  if (row) {
    log.ok({ tenantId, conversationId: row.id })
    return json(row, 201)
  }
  log.ok({ tenantId, fallback: true })
  return json(payload, 201)
}
