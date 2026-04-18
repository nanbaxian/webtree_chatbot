import { createChatSession, listChatSessions } from '../../../lib/chat-history'
import { createApiLogger } from '../../../lib/api-log'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

export const onRequestOptions = (): Response => new Response(null, { headers: cors })

export const onRequestGet: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('history:list', ctx)
  log.start()
  try {
    const sessions = await listChatSessions(ctx.env.SUPABASE_URL, ctx.env.SUPABASE_SERVICE_KEY)
    log.ok({ count: sessions.length })
    return json(sessions)
  } catch (e) {
    log.fail(e)
    return json({ error: '读取聊天记录失败' }, 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async ctx => {
  const log = createApiLogger('history:create', ctx)
  log.start()
  try {
    const body = (await ctx.request.json()) as {
      title?: string
      persona_id?: string
      session_type?: 'text' | 'voice'
    }

    const session = await createChatSession(ctx.env.SUPABASE_URL, ctx.env.SUPABASE_SERVICE_KEY, {
      title: body.title,
      persona_id: body.persona_id,
      session_type: body.session_type,
    })
    log.ok({ sessionId: session.id })
    return json(session, 201)
  } catch (e) {
    log.fail(e)
    return json({ error: '创建聊天记录失败' }, 500)
  }
}
