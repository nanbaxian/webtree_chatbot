import {
  mockSearchResponse,
  normalizeRagSearchResponse,
  type RagIngestDocumentRequest,
  type RagIngestQaRequest,
  type RagSearchRequest,
  type RagSearchResponse,
} from './protocol'

interface Env {
  RAG_DB_URL?: string
  RAG_DB_TOKEN?: string
  RAG_MOCK_JSON?: string
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id, X-Bot-Id, X-Request-Id',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function options(): Response {
  return new Response(null, { headers: cors })
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T
}

async function proxyJson(
  env: Env,
  path: string,
  method: 'POST',
  body: unknown,
): Promise<Response | null> {
  if (!env.RAG_DB_URL) return null
  const res = await fetch(`${env.RAG_DB_URL.replace(/\/+$/, '')}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(env.RAG_DB_TOKEN ? { Authorization: `Bearer ${env.RAG_DB_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return res
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return options()
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        service: 'knowledgeos-rag',
        has_db: Boolean(env.RAG_DB_URL),
        mock_mode: Boolean(env.RAG_MOCK_JSON),
      })
    }

    if (request.method === 'POST' && url.pathname === '/search') {
      const payload = await readJson<RagSearchRequest>(request)
      if (env.RAG_MOCK_JSON) {
        try {
          const mock = JSON.parse(env.RAG_MOCK_JSON) as RagSearchResponse
          const normalized = normalizeRagSearchResponse(mock)
          return json(normalized.chunks.length ? normalized : mockSearchResponse(payload))
        } catch {
          return json(mockSearchResponse(payload))
        }
      }

      const proxied = await proxyJson(env, '/search', 'POST', payload)
      if (proxied) {
        if (!proxied.ok) {
          return json({
            request_id: payload.request_id ?? null,
            chunks: [],
            warnings: [`Upstream RAG database returned ${proxied.status}`],
          }, proxied.status)
        }
        const raw = await proxied.json().catch(() => ({}))
        return json(normalizeRagSearchResponse(raw))
      }

      return json({
        request_id: payload.request_id ?? null,
        chunks: [],
        warnings: ['No RAG_DB_URL configured yet.'],
      }, 503)
    }

    if (request.method === 'POST' && url.pathname === '/ingest/document') {
      const payload = await readJson<RagIngestDocumentRequest>(request)
      const proxied = await proxyJson(env, '/ingest/document', 'POST', payload)
      if (proxied) return proxied
      return json({ ok: false, warning: 'No RAG_DB_URL configured yet.' }, 503)
    }

    if (request.method === 'POST' && url.pathname === '/ingest/qa') {
      const payload = await readJson<RagIngestQaRequest>(request)
      const proxied = await proxyJson(env, '/ingest/qa', 'POST', payload)
      if (proxied) return proxied
      return json({ ok: false, warning: 'No RAG_DB_URL configured yet.' }, 503)
    }

    return json({ error: 'Not found' }, 404)
  },
}
