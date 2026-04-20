// functions/api/chat.ts
// POST /api/chat - KnowledgeOS RAG orchestration entry

import { createApiLogger } from '../../lib/api-log'
import {
  buildRagSearchRequest,
  formatRagPromptBlock,
  normalizeRagSearchResponse,
  selectRagCitations,
  serializeRagCitationsHeader,
  type RagChunk,
} from '../../lib/rag-protocol'
import { type OpenAIMessage } from '../../lib/openai-client'
import { type ReplyLanguage } from '../../types/index'
import {
  botSeed,
  conversationSeed,
  getBot,
  getConversation,
  insertMessage,
  insertMessageCitations,
  listMessages,
  parseSettings,
  readTenantId,
  type D1Bot,
  type D1Env,
  type D1Message,
  upsertBot,
  upsertConversation,
} from '../../lib/knowledgeos-d1'

interface Env extends D1Env {
  BUCKET: R2Bucket
  OPENAI_MODEL?: string
  OPENAI_MAX_TOKENS?: string
  OPENAI_COALESCE_CHARS?: string
  CHAT_BACKEND_URL: string
  CHAT_BACKEND_TIMEOUT_MS?: string
  RAG_API_URL?: string
  RAG_API_KEY?: string
  RAG_REQUEST_TIMEOUT_MS?: string
  AI: Ai
}

function extractR2KeyFromUrl(imageUrl: string): string | null {
  let path = imageUrl
  try {
    if (/^https?:\/\//i.test(imageUrl)) path = new URL(imageUrl).pathname
  } catch {
    return null
  }
  const m = path.match(/^\/r2\/([A-Za-z0-9\-]+)$/)
  if (!m) return null
  return m[1]
}

async function r2ImageUrlToBase64(env: Env, imageUrl: string): Promise<{ base64: string; mime: string } | null> {
  const key = extractR2KeyFromUrl(imageUrl)
  if (!key) return null
  const obj = await env.BUCKET.get(key)
  if (!obj) return null
  const mime = obj.httpMetadata?.contentType || 'image/png'
  const buf = await obj.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return { base64: btoa(binary), mime }
}

async function loadRagContext(
  env: Env,
  tenantId: string,
  botId: string,
  query: string,
  topK: number,
  requestId: string,
  conversationId?: string | null,
  locale?: ReplyLanguage,
): Promise<{ chunks: RagChunk[]; promptBlock: string }> {
  const ragApiUrl = (env.RAG_API_URL || 'https://rag.webtreeedu.com').replace(/\/+$/, '')

  try {
    const abortController = new AbortController()
    const timeoutMs = Number.parseInt(env.RAG_REQUEST_TIMEOUT_MS || '', 10)
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000
    const timer = setTimeout(() => abortController.abort('RAG request timed out'), timeout)
    const request = buildRagSearchRequest({
      tenantId,
      botId,
      query,
      topK,
      conversationId,
      requestId,
      locale,
    })
    const res = await fetch(`${ragApiUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
        'X-Bot-Id': botId,
        'X-Request-Id': requestId,
        ...(env.RAG_API_KEY ? { Authorization: `Bearer ${env.RAG_API_KEY}` } : {}),
      },
      body: JSON.stringify(request),
      signal: abortController.signal,
    }).finally(() => {
      clearTimeout(timer)
    })
    if (!res.ok) {
      return {
        chunks: [],
        promptBlock: `External RAG service returned ${res.status}.`,
      }
    }
    const data = normalizeRagSearchResponse(await res.json())
    const chunks = data.chunks
    const promptBlock = formatRagPromptBlock(chunks, topK)
    return { chunks, promptBlock }
  } catch (error) {
    console.error('[knowledgeos:rag] retrieval failed', error)
    return {
      chunks: [],
      promptBlock: 'External RAG retrieval failed. Respond carefully and avoid fabricating knowledge-base facts.',
    }
  }
}

function toOpenAIHistory(messages: D1Message[], currentUserText: string, imageBase64?: string, imageMime?: string): OpenAIMessage[] {
  const history: OpenAIMessage[] = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    parts: [{ text: msg.content || '' }],
  }))

  const parts: OpenAIMessage['parts'] = []
  if (imageBase64) {
    parts.push({ inlineData: { mimeType: imageMime || 'image/jpeg', data: imageBase64 } })
  }
  parts.push({ text: currentUserText || 'Please answer the latest user message.' })
  history.push({ role: 'user', parts })
  return history
}

function buildSystemPrompt(
  bot: D1Bot,
  tenantName: string,
  language: ReplyLanguage,
  ragPromptBlock: string,
  latestUserText: string,
): string {
  const langRule = language === 'en'
    ? [
        '- Reply fully in natural English.',
        '- Do not use Chinese characters.',
      ].join('\n')
    : [
        '- Reply fully in Simplified Chinese.',
        '- Do not mix in English unless it is a product name, code, or proper noun.',
      ].join('\n')

  const botSettings = parseSettings<Record<string, unknown>>(bot.settings_json, {})
  const maxTurns = typeof botSettings.max_history_turns === 'number' ? botSettings.max_history_turns : 10

  return [
    `You are ${bot.name} for tenant "${tenantName}".`,
    `Persona: ${bot.persona}`,
    `Tone: ${bot.tone}`,
    `Welcome: ${bot.welcome_msg}`,
    `Fallback if knowledge is missing: ${bot.fallback_msg}`,
    `Language rules:\n${langRule}`,
    `Conversation policy:\n- Answer directly.\n- Do not invent knowledge-base facts.\n- If the user asks for a source-backed answer, prefer retrieved evidence.\n- Cite sources in plain language when available.`,
    `Memory policy:\n- Use only the recent conversation history.\n- Respect the configured turn budget of ${maxTurns}.`,
    `Latest user message:\n"""${latestUserText.slice(0, 1200)}"""`,
    `Retrieved knowledge:\n${ragPromptBlock}`,
  ].join('\n\n---\n\n')
}

async function ensureConversation(env: Env, tenantId: string, bot: D1Bot, conversationId: string | null, titleSeed: string): Promise<{ conversationId: string; conversationTitle: string }> {
  if (conversationId) {
    const existing = await getConversation(env, conversationId)
    if (existing && existing.tenant_id === tenantId) {
      return { conversationId: existing.id, conversationTitle: existing.title }
    }
  }

  const conversation = conversationSeed(tenantId, bot.id, titleSeed)
  const row = await upsertConversation(env, conversation)
  const created = row ?? conversation
  return { conversationId: created.id, conversationTitle: created.title }
}

async function saveUsage(
  env: Env,
  tenantId: string,
  botId: string,
  date: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  if (!env.DB) return
  await env.DB.prepare(
    `INSERT INTO usage_logs (id, tenant_id, bot_id, date, input_tokens, output_tokens, messages_count, queries_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)
     ON CONFLICT(tenant_id, bot_id, date) DO UPDATE SET
       input_tokens = input_tokens + excluded.input_tokens,
       output_tokens = output_tokens + excluded.output_tokens,
       messages_count = messages_count + excluded.messages_count,
       queries_count = queries_count + excluded.queries_count`,
  )
    .bind(crypto.randomUUID(), tenantId, botId, date, inputTokens, outputTokens, new Date().toISOString())
    .run()
}

async function saveRetrievalLog(
  env: Env,
  tenantId: string,
  botId: string,
  query: string,
  chunks: RagChunk[],
  latencyMs: number,
): Promise<void> {
  if (!env.DB) return
  await env.DB.prepare(
    `INSERT INTO retrieval_logs (id, tenant_id, bot_id, query, chunks_retrieved, rerank_scores, latency_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      tenantId,
      botId,
      query,
      chunks.length,
      JSON.stringify(chunks.map(chunk => chunk.score ?? 0)),
      latencyMs,
      new Date().toISOString(),
    )
    .run()
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
}

export const onRequestOptions = (): Response => new Response(null, { headers: cors })

export const onRequestPost: PagesFunction<Env> = async ctx => {
  const { request, env } = ctx
  const apiLog = createApiLogger('knowledgeos:chat:post', ctx)
  const reqId = apiLog.reqId
  const startedAt = Date.now()
  apiLog.start()

  let body: {
    tenant_id?: string
    bot_id?: string
    conversation_id?: string
    session_id?: string
    message?: string
    imageBase64?: string
    imageUrl?: string
    replyLanguage?: ReplyLanguage
    voice_mode?: boolean
  }

  try {
    body = await request.json()
  } catch (error) {
    apiLog.fail(error, { stage: 'parse' })
    return errJson('请求格式错误', 400)
  }

  const tenantId = body.tenant_id || readTenantId(request)
  const message = (body.message || '').trim()
  const voiceMode = body.voice_mode === true
  const replyLanguage: ReplyLanguage = body.replyLanguage === 'en' ? 'en' : 'zh'
  let imageBase64 = body.imageBase64
  let imageMime = 'image/jpeg'

  if (!imageBase64 && body.imageUrl) {
    const r2 = await r2ImageUrlToBase64(env, body.imageUrl)
    if (r2?.base64) {
      imageBase64 = r2.base64
      imageMime = r2.mime
    }
  }

  if (!message && !imageBase64) {
    apiLog.fail('empty message and image', { stage: 'validate', tenantId })
    return errJson('消息不能为空', 400)
  }

  const botId = body.bot_id || 'bot_demo'
  let bot = await getBot(env, botId)
  if (!bot && env.DB) {
    bot = await upsertBot(env, botSeed(tenantId, { id: botId }))
  }
  if (!bot) {
    bot = botSeed(tenantId, { id: botId })
  }

  const conversationKey = body.conversation_id || body.session_id || null
  const { conversationId, conversationTitle } = await ensureConversation(
    env,
    tenantId,
    bot,
    conversationKey,
    message.slice(0, 32) || 'New conversation',
  )

  const recentMessages = env.DB
    ? await listMessages(env, conversationId, 10)
    : null
  const history = Array.isArray(recentMessages) ? recentMessages : []

  const ragStartedAt = Date.now()
  const rag = await loadRagContext(env, tenantId, bot.id, message, 8, reqId, conversationKey, replyLanguage)
  const ragLatencyMs = Date.now() - ragStartedAt
  await saveRetrievalLog(env, tenantId, bot.id, message, rag.chunks, ragLatencyMs)
  const citations = selectRagCitations(rag.chunks, 3)
  const citationsHeader = serializeRagCitationsHeader(citations)
  const assistantMessageId = crypto.randomUUID()

  const systemPrompt = buildSystemPrompt(bot, tenantId, replyLanguage, rag.promptBlock, message)
  const messages = toOpenAIHistory(history, message, imageBase64, imageMime)

  if (env.DB) {
    await insertMessage(env, {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      role: 'user',
      content: message || '（发送了图片）',
      model: null,
      input_tokens: 0,
      output_tokens: 0,
      created_at: new Date().toISOString(),
    })
  }

  const maxOutputTokens = voiceMode ? 64 : Number.parseInt(env.OPENAI_MAX_TOKENS || '', 10)
  const coalesceChars = voiceMode ? 4 : Number.parseInt(env.OPENAI_COALESCE_CHARS || '', 10)
  const openaiModel = env.OPENAI_MODEL || 'gpt-4.1-nano'
  const provider = 'worker-backend'

  apiLog.info('generation:start', {
    tenantId,
    botId: bot.id,
    conversationId,
    provider,
    historyCount: history.length,
    ragChunks: rag.chunks.length,
    prepMs: Date.now() - startedAt,
  })

  let upstream: ReadableStream<Uint8Array>
  try {
    if (!env.CHAT_BACKEND_URL) {
      apiLog.fail('missing CHAT_BACKEND_URL', { stage: 'model', provider })
      return errJson('缺少 CHAT_BACKEND_URL', 500)
    }
    const backendAbort = new AbortController()
    const timeoutMs = Number.parseInt(env.CHAT_BACKEND_TIMEOUT_MS || '', 10)
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000
    const timer = setTimeout(() => backendAbort.abort('chat backend timed out'), timeout)
    const backendRes = await fetch(`${env.CHAT_BACKEND_URL.replace(/\/+$/, '')}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KnowledgeOS-Request-Id': reqId,
      },
      body: JSON.stringify({
        systemPrompt,
        messages,
        model: openaiModel,
        maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : undefined,
        coalesceChars: Number.isFinite(coalesceChars) ? coalesceChars : undefined,
        reqId,
      }),
      signal: backendAbort.signal,
    }).finally(() => {
      clearTimeout(timer)
    })
    if (!backendRes.ok) {
      const errText = await backendRes.text()
      apiLog.fail(`backend status=${backendRes.status} body=${errText.slice(0, 300)}`, {
        stage: 'model',
        provider,
      })
      return errJson(`模型后端错误: ${errText.slice(0, 180) || backendRes.status}`, 500)
    }
    if (!backendRes.body) {
      apiLog.fail('backend body empty', { stage: 'model', provider })
      return errJson('模型调用失败', 500)
    }
    upstream = backendRes.body
  } catch (error) {
    apiLog.fail(error, { stage: 'model', provider })
    return errJson('模型调用失败', 500)
  }

  let fullText = ''
  let savedAi = false
  let chatBuffer = ''

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      ctrl.enqueue(chunk)
      try {
        chatBuffer += new TextDecoder().decode(chunk)
        const lines = chatBuffer.split('\n')
        chatBuffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const d = JSON.parse(line.slice(6)) as { text?: string; error?: string; done?: boolean }
            if (d.text) fullText += d.text
            if (d.error) console.error(`[knowledgeos:chat ${reqId}] stream_error=${String(d.error).slice(0, 300)}`)
            if (d.done && !savedAi) {
              savedAi = true
              if (env.DB) {
                void insertMessage(env, {
                  id: assistantMessageId,
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: fullText || '...',
                  model: openaiModel,
                  input_tokens: 0,
                  output_tokens: 0,
                  created_at: new Date().toISOString(),
                })
                if (citations.length > 0) {
                  void insertMessageCitations(env, assistantMessageId, citations)
                }
              }
              void saveUsage(env, tenantId, bot.id, new Date().toISOString().slice(0, 10), message.length, fullText.length)
              apiLog.ok({
                tenantId,
                botId: bot.id,
                conversationId,
                title: conversationTitle,
                fullLen: fullText.length,
              })
            }
          } catch {
            // ignore malformed SSE chunk lines
          }
        }
      } catch {
        // ignore decode errors
      }
    },
    flush() {
      if (chatBuffer.startsWith('data: ') && !savedAi) {
        try {
          const d = JSON.parse(chatBuffer.slice(6)) as { done?: boolean }
          if (d.done) {
            savedAi = true
            if (env.DB) {
                void insertMessage(env, {
                  id: assistantMessageId,
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: fullText || '...',
                  model: openaiModel,
                  input_tokens: 0,
                  output_tokens: 0,
                  created_at: new Date().toISOString(),
                })
              if (citations.length > 0) {
                void insertMessageCitations(env, assistantMessageId, citations)
              }
            }
            void saveUsage(env, tenantId, bot.id, new Date().toISOString().slice(0, 10), message.length, fullText.length)
            apiLog.ok({
              tenantId,
              botId: bot.id,
              conversationId,
              title: conversationTitle,
              fullLen: fullText.length,
              source: 'flush',
            })
          }
        } catch {
          // ignore
        }
      }
    },
  })

  return new Response(upstream.pipeThrough(transform), {
    headers: {
      ...cors,
      'Access-Control-Expose-Headers': [
        'X-Tenant-Id',
        'X-Bot-Id',
        'X-Conversation-Id',
        'X-KnowledgeOS-Request-Id',
        'X-KnowledgeOS-Citations',
        'X-KnowledgeOS-Citation-Count',
        'X-KnowledgeOS-RAG-Latency-Ms',
      ].join(', '),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      'X-Tenant-Id': tenantId,
      'X-Bot-Id': bot.id,
      'X-Conversation-Id': conversationId,
      'X-KnowledgeOS-Request-Id': reqId,
      'X-KnowledgeOS-Citations': citationsHeader,
      'X-KnowledgeOS-Citation-Count': String(citations.length),
      'X-KnowledgeOS-RAG-Latency-Ms': String(ragLatencyMs),
    },
  })
}

function errJson(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
