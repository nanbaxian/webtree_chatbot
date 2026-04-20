// workers/cron-worker.ts
// Standalone Cloudflare Worker for Cron Trigger and chat backend.
// Deploy with: wrangler deploy --config workers/wrangler-cron.toml

import { compressMemories } from '../lib/memory-engine'
import { streamOpenAIChat, type OpenAIMessage } from '../lib/openai-client'

interface Env {
  OPENAI_API_KEY: string
  OPENAI_MODEL?: string
  OPENAI_MAX_TOKENS?: string
  OPENAI_COALESCE_CHARS?: string
  OPENAI_ORG_ID?: string
  OPENAI_PROJECT_ID?: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  AI: Ai
}

interface ChatRequestBody {
  systemPrompt?: string
  messages?: OpenAIMessage[]
  model?: string
  maxOutputTokens?: number
  coalesceChars?: number
  reqId?: string
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-KnowledgeOS-Request-Id',
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...cors,
      ...(init.headers || {}),
    },
  })
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    console.log('[cron] Starting memory compression...')
    try {
      await compressMemories(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        env.OPENAI_API_KEY,
        env.AI,
      )
      console.log('[cron] Done.')
    } catch (err) {
      console.error('[cron] Failed:', err)
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        service: 'webtree-chatbot-back',
        has_openai_key: Boolean(env.OPENAI_API_KEY),
        model: env.OPENAI_MODEL || 'gpt-4.1',
      })
    }

    if (request.method !== 'POST' || url.pathname !== '/chat') {
      return new Response('POST /chat only', { status: 405, headers: cors })
    }

    try {
      const body = (await request.json()) as ChatRequestBody
      const systemPrompt = String(body.systemPrompt || '').trim()
      const messages = Array.isArray(body.messages) ? body.messages : []
      if (!systemPrompt || !messages.length) {
        return json({ error: 'systemPrompt and messages are required' }, { status: 400 })
      }
      if (!env.OPENAI_API_KEY) {
        return json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
      }

      const stream = await streamOpenAIChat(env.OPENAI_API_KEY, systemPrompt, messages, {
        reqId: body.reqId || 'cron-worker',
        model: body.model || env.OPENAI_MODEL || 'gpt-4.1',
        maxOutputTokens: Number.isFinite(body.maxOutputTokens)
          ? body.maxOutputTokens
          : Number.parseInt(env.OPENAI_MAX_TOKENS || '', 10) || undefined,
        coalesceChars: Number.isFinite(body.coalesceChars)
          ? body.coalesceChars
          : Number.parseInt(env.OPENAI_COALESCE_CHARS || '', 10) || undefined,
        orgId: env.OPENAI_ORG_ID,
        projectId: env.OPENAI_PROJECT_ID,
      })

      return new Response(stream, {
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return json({ error: msg }, { status: 500 })
    }
  },
}
