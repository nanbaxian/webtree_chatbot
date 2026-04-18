// functions/api/memory/compress.ts
// POST /api/memory/compress

import { compressMemories } from '../../../lib/memory-engine'
import { createApiLogger } from '../../../lib/api-log'

interface Env {
  DEEPINFRA_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  CRON_SECRET: string
  AI: Ai
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

export const onRequestOptions = (): Response => new Response(null, { headers: cors })

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  const log = createApiLogger('memory:compress:post', ctx)
  log.start()

  const auth = request.headers.get('Authorization') ?? ''
  const origin = request.headers.get('Origin') ?? ''
  const referer = request.headers.get('Referer') ?? ''
  const reqHost = new URL(request.url).host
  const fromSameHost =
    (origin && new URL(origin).host === reqHost) ||
    (referer && new URL(referer).host === reqHost)

  const isAuthorized = auth === `Bearer ${env.CRON_SECRET}` || fromSameHost
  if (!isAuthorized) {
    log.fail('unauthorized', { stage: 'authz', hasAuth: Boolean(auth), fromSameHost })
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    await compressMemories(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, env.DEEPINFRA_API_KEY, env.AI)
    log.ok({ triggeredBy: auth ? 'cron' : 'same-origin' })
    return json({ success: true, timestamp: new Date().toISOString() })
  } catch (err: unknown) {
    log.fail(err, { stage: 'compress' })
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
}

