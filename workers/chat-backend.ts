// workers/chat-backend.ts
// Cloudflare Worker backend for OpenAI chat generation.

import { streamOpenAIChat, type OpenAIMessage } from '../lib/openai-client'

interface Env {
  OPENAI_API_KEY: string
  OPENAI_MODEL?: string
  OPENAI_MAX_TOKENS?: string
  OPENAI_COALESCE_CHARS?: string
  OPENAI_ORG_ID?: string
  OPENAI_PROJECT_ID?: string
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
      return json({ error: 'Not found' }, { status: 404 })
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
    }

    let body: ChatRequestBody
    try {
      body = (await request.json()) as ChatRequestBody
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const systemPrompt = String(body.systemPrompt || '').trim()
    const messages = Array.isArray(body.messages) ? body.messages : []
    if (!systemPrompt || !messages.length) {
      return json({ error: 'systemPrompt and messages are required' }, { status: 400 })
    }

    try {
      const stream = await streamOpenAIChat(env.OPENAI_API_KEY, systemPrompt, messages, {
        reqId: body.reqId || 'backend',
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
    } catch (error) {
      console.error('[chat-backend] generation failed', error)
      return json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 })
    }
  },
}
