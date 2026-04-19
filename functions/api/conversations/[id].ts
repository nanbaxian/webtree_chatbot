import { createApiLogger } from '../../../lib/api-log'
import { json, options } from '../_knowledgeos-shared'
import {
  deleteConversation,
  getConversation,
  listMessageCitations,
  listMessages,
  readTenantId,
  type D1Conversation,
  type D1Env,
  upsertConversation,
} from '../../../lib/knowledgeos-d1'

interface Env extends D1Env {}

export const onRequestOptions = options

export const onRequestGet: PagesFunction<Env, 'id'> = async ctx => {
  const log = createApiLogger('knowledgeos:conversations:id:get', ctx)
  log.start()
  const conversationId = ctx.params.id
  const row = await getConversation(ctx.env, conversationId)
  if (row) {
    const [messages, citations] = await Promise.all([
      listMessages(ctx.env, conversationId, 100),
      listMessageCitations(ctx.env, conversationId),
    ])
    const citationMap = new Map<string, Array<Record<string, unknown>>>()
    for (const citation of citations || []) {
      const mapped = {
        id: citation.id,
        chunk_id: citation.chunk_id,
        qa_pair_id: citation.qa_pair_id,
        score: citation.score,
        source_label: citation.source_label,
        source_url: citation.source_url,
        page_num: citation.page_num,
        created_at: citation.created_at,
      }
      const list = citationMap.get(citation.message_id) || []
      list.push(mapped)
      citationMap.set(citation.message_id, list)
    }
    return json({
      ...row,
      messages: (messages || []).map(message => ({
        ...message,
        citations: citationMap.get(message.id) || [],
      })),
    })
  }
  return json({ error: 'Conversation not found' }, 404)
}

export const onRequestPatch: PagesFunction<Env, 'id'> = async ctx => {
  const conversationId = ctx.params.id
  const tenantId = readTenantId(ctx.request)
  const body = await ctx.request.json().catch(() => ({})) as Partial<D1Conversation>
  const now = new Date().toISOString()
  const payload: D1Conversation = {
    id: conversationId,
    tenant_id: tenantId,
    bot_id: body.bot_id || 'bot_demo',
    created_by: body.created_by ?? null,
    title: body.title || 'New conversation',
    channel: body.channel || 'dashboard',
    created_at: body.created_at || now,
    updated_at: now,
  }
  const row = await upsertConversation(ctx.env, payload)
  return json(row ?? payload)
}

export const onRequestDelete: PagesFunction<Env, 'id'> = async ctx => {
  const ok = await deleteConversation(ctx.env, ctx.params.id)
  return ok ? json({ success: true }) : json({ success: false }, 404)
}
