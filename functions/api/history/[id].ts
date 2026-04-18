import { deleteChatSession, getChatSession, patchChatSession } from '../../../lib/chat-history'
import { createApiLogger } from '../../../lib/api-log'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function sessionIdFromRequest(request: Request): string {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

export const onRequestOptions = (): Response => new Response(null, { headers: cors })

export const onRequestGet: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('history:get', ctx)
  log.start()
  try {
    const sessionId = sessionIdFromRequest(ctx.request)
    if (!sessionId) return json({ error: '缺少 session id' }, 400)
    const session = await getChatSession(ctx.env.SUPABASE_URL, ctx.env.SUPABASE_SERVICE_KEY, sessionId)
    if (!session) return json({ error: '聊天记录不存在' }, 404)
    log.ok({ sessionId, messageCount: session.message_count })
    return json(session)
  } catch (e) {
    log.fail(e)
    return json({ error: '读取聊天记录失败' }, 500)
  }
}

export const onRequestPatch: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('history:patch', ctx)
  log.start()
  try {
    const sessionId = sessionIdFromRequest(ctx.request)
    if (!sessionId) return json({ error: '缺少 session id' }, 400)
    const body = (await ctx.request.json()) as { title?: string; is_pinned?: boolean }
    const session = await patchChatSession(ctx.env.SUPABASE_URL, ctx.env.SUPABASE_SERVICE_KEY, sessionId, body)
    if (!session) return json({ error: '聊天记录不存在' }, 404)
    log.ok({ sessionId, isPinned: session.is_pinned })
    return json(session)
  } catch (e) {
    log.fail(e)
    return json({ error: '更新聊天记录失败' }, 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('history:delete', ctx)
  log.start()
  try {
    const sessionId = sessionIdFromRequest(ctx.request)
    if (!sessionId) return json({ error: '缺少 session id' }, 400)
    await deleteChatSession(ctx.env.SUPABASE_URL, ctx.env.SUPABASE_SERVICE_KEY, sessionId)
    log.ok({ sessionId })
    return json({ success: true })
  } catch (e) {
    log.fail(e)
    return json({ error: '删除聊天记录失败' }, 500)
  }
}
