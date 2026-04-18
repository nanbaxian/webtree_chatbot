// lib/api-log.ts
// Shared structured logging for Pages Functions APIs.

type CtxLike = { request: Request }

type Meta = Record<string, unknown>

function baseMeta(ctx: CtxLike, reqId: string): Meta {
  const requestUrl = new URL(ctx.request.url)
  return {
    reqId,
    ray: ctx.request.headers.get('cf-ray') || 'no-ray',
    method: ctx.request.method,
    path: requestUrl.pathname,
  }
}

export function createApiLogger(route: string, ctx: CtxLike) {
  const reqId = crypto.randomUUID().slice(0, 8)
  const startedAt = Date.now()
  const base = baseMeta(ctx, reqId)

  function log(level: 'log' | 'error', event: string, meta?: Meta): void {
    const payload = meta ? { ...base, ...meta } : base
    console[level](`[${route}] ${event}`, payload)
  }

  return {
    reqId,
    start(meta?: Meta) {
      log('log', 'request:start', meta)
    },
    info(event: string, meta?: Meta) {
      log('log', event, meta)
    },
    ok(meta?: Meta) {
      log('log', 'request:ok', { elapsedMs: Date.now() - startedAt, ...(meta || {}) })
    },
    fail(error: unknown, meta?: Meta) {
      const message = error instanceof Error ? error.message : String(error)
      log('error', 'request:fail', { elapsedMs: Date.now() - startedAt, error: message, ...(meta || {}) })
    },
  }
}

