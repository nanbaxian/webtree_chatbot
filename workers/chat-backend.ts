// workers/chat-backend.ts
// Cloudflare Worker backend for OpenAI chat generation and query rewriting.

import { completeOpenAIChat, streamOpenAIChat, type OpenAIMessage } from '../lib/openai-client'

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

interface ChatCompleteRequestBody {
  systemPrompt?: string
  messages?: OpenAIMessage[]
  model?: string
  maxOutputTokens?: number
  reqId?: string
}

interface RewriteRequestBody {
  text?: string
  reqId?: string
  model?: string
  maxOutputTokens?: number
}

interface TranslateRequestBody {
  text?: string
  targetLanguage?: string
  reqId?: string
  model?: string
  maxOutputTokens?: number
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

    if (request.method === 'POST' && url.pathname === '/rewrite-query') {
      if (!env.OPENAI_API_KEY) {
        return json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
      }

      let body: RewriteRequestBody
      try {
        body = (await request.json()) as RewriteRequestBody
      } catch {
        return json({ error: 'Invalid JSON' }, { status: 400 })
      }

      const text = String(body.text || '').trim()
      if (!text) {
        return json({ error: 'text is required' }, { status: 400 })
      }

      const prompt = [
        'Rewrite the user query into concise English search keywords for a school RAG system.',
        'Rules:',
        '- Output only the rewritten English query.',
        '- Do not add explanation, labels, quotes, bullets, or markdown.',
        '- Keep school names, course codes, numbers, dates, and proper nouns unchanged when useful.',
        '- Expand colloquial Chinese into search-friendly English terms.',
        '- Prefer retrieval keywords such as tuition, admission requirements, university placement, graduation outcomes, schedule, contact, address, registration, accreditation, homestay, student life, and OSSD when relevant.',
        '- If the input is already English, normalize it into a shorter search query.',
        '',
        `User query: ${text}`,
      ].join('\n')

      try {
        const output = await completeOpenAIChat(env.OPENAI_API_KEY, prompt, {
          reqId: body.reqId || 'rewrite',
          model: body.model || env.OPENAI_MODEL || 'gpt-4.1',
          maxOutputTokens: Number.isFinite(body.maxOutputTokens)
            ? body.maxOutputTokens
            : 96,
          orgId: env.OPENAI_ORG_ID,
          projectId: env.OPENAI_PROJECT_ID,
        })

        return json({ text: output.trim() })
      } catch (error) {
        console.error('[chat-backend] rewrite failed', error)
        return json({ error: error instanceof Error ? error.message : 'Rewrite failed' }, { status: 500 })
      }
    }

    if (request.method === 'POST' && url.pathname === '/translate-text') {
      if (!env.OPENAI_API_KEY) {
        return json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
      }

      let body: TranslateRequestBody
      try {
        body = (await request.json()) as TranslateRequestBody
      } catch {
        return json({ error: 'Invalid JSON' }, { status: 400 })
      }

      const text = String(body.text || '').trim()
      if (!text) {
        return json({ error: 'text is required' }, { status: 400 })
      }

      const targetLanguage = String(body.targetLanguage || 'zh').trim().toLowerCase()
      const languageLabel = targetLanguage === 'en' ? 'English' : 'Simplified Chinese'
      const prompt = [
        `Translate the following answer into ${languageLabel}.`,
        'Rules:',
        '- Output only the translated text.',
        '- Preserve school names, course codes, numbers, dates, URLs, email addresses, and phone numbers exactly when possible.',
        '- Preserve factual meaning and tone.',
        '- Do not add explanations, labels, bullets, or markdown.',
        '- If the text is already in the target language, lightly normalize it without changing meaning.',
        '',
        `Text: ${text}`,
      ].join('\n')

      try {
        const output = await completeOpenAIChat(env.OPENAI_API_KEY, prompt, {
          reqId: body.reqId || 'translate',
          model: body.model || env.OPENAI_MODEL || 'gpt-4.1',
          maxOutputTokens: Number.isFinite(body.maxOutputTokens)
            ? body.maxOutputTokens
            : 256,
          orgId: env.OPENAI_ORG_ID,
          projectId: env.OPENAI_PROJECT_ID,
        })

        return json({ text: output.trim() })
      } catch (error) {
        console.error('[chat-backend] translate failed', error)
        return json({ error: error instanceof Error ? error.message : 'Translate failed' }, { status: 500 })
      }
    }

    if (request.method === 'POST' && url.pathname === '/chat-complete') {
      if (!env.OPENAI_API_KEY) {
        return json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
      }

      let body: ChatCompleteRequestBody
      try {
        body = (await request.json()) as ChatCompleteRequestBody
      } catch {
        return json({ error: 'Invalid JSON' }, { status: 400 })
      }

      const systemPrompt = String(body.systemPrompt || '').trim()
      const messages = Array.isArray(body.messages) ? body.messages : []
      if (!systemPrompt || !messages.length) {
        return json({ error: 'systemPrompt and messages are required' }, { status: 400 })
      }

      try {
        const text = await completeOpenAIChat(env.OPENAI_API_KEY, systemPrompt, messages, {
          reqId: body.reqId || 'complete',
          model: body.model || env.OPENAI_MODEL || 'gpt-4.1',
          maxOutputTokens: Number.isFinite(body.maxOutputTokens)
            ? body.maxOutputTokens
            : Number.parseInt(env.OPENAI_MAX_TOKENS || '', 10) || undefined,
          orgId: env.OPENAI_ORG_ID,
          projectId: env.OPENAI_PROJECT_ID,
        })

        return json({ text })
      } catch (error) {
        console.error('[chat-backend] completion failed', error)
        return json({ error: error instanceof Error ? error.message : 'Completion failed' }, { status: 500 })
      }
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
