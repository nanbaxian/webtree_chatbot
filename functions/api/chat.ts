// functions/api/chat.ts
// POST /api/chat - KnowledgeOS RAG orchestration entry

import { createApiLogger } from '../../lib/api-log'
import { streamGemini, streamGeminiFlashLite, type GeminiMessage } from '../../lib/gemini-client'
import { type ReplyLanguage } from '../../types/index'
import {
  botSeed,
  conversationSeed,
  getBot,
  getConversation,
  insertMessage,
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
  DEEPINFRA_API_KEY: string
  GEMINI_API_KEY?: string
  GEMINI_VISION_MODEL?: string
  VOICE_FAST_MODEL?: string
  DEEPINFRA_MODEL?: string
  DEEPINFRA_MAX_TOKENS?: string
  DEEPINFRA_COALESCE_CHARS?: string
  RAG_API_URL?: string
  RAG_API_KEY?: string
  AI: Ai
}

type RAGChunk = {
  title?: string
  section?: string
  source_url?: string
  page_num?: number
  content?: string
  score?: number
  source_label?: string
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
): Promise<{ chunks: RAGChunk[]; promptBlock: string }> {
  if (!env.RAG_API_URL) {
    return {
      chunks: [],
      promptBlock: [
        'No external RAG service is configured yet.',
        'Answer from the conversation state and bot settings only.',
        'If the user asks for knowledge-base facts, say the knowledge store is not yet connected.',
      ].join('\n'),
    }
  }

  try {
    const res = await fetch(`${env.RAG_API_URL.replace(/\/+$/, '')}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.RAG_API_KEY ? { Authorization: `Bearer ${env.RAG_API_KEY}` } : {}),
      },
      body: JSON.stringify({ tenant_id: tenantId, bot_id: botId, query, top_k: topK }),
    })
    if (!res.ok) {
      return {
        chunks: [],
        promptBlock: `External RAG service returned ${res.status}.`,
      }
    }
    const data = (await res.json()) as { chunks?: RAGChunk[] }
    const chunks = Array.isArray(data.chunks) ? data.chunks : []
    const promptBlock = chunks.length
      ? chunks
          .slice(0, topK)
          .map((chunk, idx) => {
            const label = chunk.source_label || chunk.title || `Source ${idx + 1}`
            const location = [chunk.section, chunk.page_num ? `page ${chunk.page_num}` : null].filter(Boolean).join(' / ')
            return [
              `- ${label}${location ? ` (${location})` : ''}`,
              chunk.source_url ? `  URL: ${chunk.source_url}` : '',
              chunk.content ? `  Excerpt: ${chunk.content.slice(0, 500)}` : '',
            ]
              .filter(Boolean)
              .join('\n')
          })
          .join('\n\n')
      : 'No relevant chunks were returned by the external RAG service.'
    return { chunks, promptBlock }
  } catch (error) {
    console.error('[knowledgeos:rag] retrieval failed', error)
    return {
      chunks: [],
      promptBlock: 'External RAG retrieval failed. Respond carefully and avoid fabricating knowledge-base facts.',
    }
  }
}

function toGeminiHistory(messages: D1Message[], currentUserText: string, imageBase64?: string): GeminiMessage[] {
  const history: GeminiMessage[] = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content || '' }],
  }))

  const parts: GeminiMessage['parts'] = []
  if (imageBase64) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } })
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
  chunks: RAGChunk[],
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

  if (!imageBase64 && body.imageUrl) {
    const r2 = await r2ImageUrlToBase64(env, body.imageUrl)
    if (r2?.base64) imageBase64 = r2.base64
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
  const rag = await loadRagContext(env, tenantId, bot.id, message, 8)
  await saveRetrievalLog(env, tenantId, bot.id, message, rag.chunks, Date.now() - ragStartedAt)

  const systemPrompt = buildSystemPrompt(bot, tenantId, replyLanguage, rag.promptBlock, message)
  const messages = toGeminiHistory(history, message, imageBase64)

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

  const maxOutputTokens = voiceMode ? 64 : Number.parseInt(env.DEEPINFRA_MAX_TOKENS || '', 10)
  const coalesceChars = voiceMode ? 4 : Number.parseInt(env.DEEPINFRA_COALESCE_CHARS || '', 10)
  const deepinfraModel = voiceMode
    ? (env.VOICE_FAST_MODEL || env.DEEPINFRA_MODEL || 'meta-llama/Llama-3.2-3B-Instruct')
    : (env.DEEPINFRA_MODEL || 'meta-llama/Llama-3.2-3B-Instruct')
  const visionModel = env.GEMINI_VISION_MODEL || 'gemini-2.5-flash-lite'
  const provider = imageBase64 ? 'gemini' : 'deepinfra'

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
    if (imageBase64) {
      if (!env.GEMINI_API_KEY) {
        apiLog.fail('missing GEMINI_API_KEY', { stage: 'model', provider: 'gemini' })
        return errJson('缺少 GEMINI_API_KEY（图片分析需要 Gemini）', 500)
      }
      upstream = await streamGeminiFlashLite(env.GEMINI_API_KEY, systemPrompt, messages, {
        debug: true,
        reqId,
        model: visionModel,
        maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : undefined,
        coalesceChars: Number.isFinite(coalesceChars) ? coalesceChars : undefined,
      })
    } else {
      upstream = await streamGemini(env.DEEPINFRA_API_KEY, systemPrompt, messages, {
        debug: true,
        reqId,
        model: deepinfraModel,
        maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : undefined,
        coalesceChars: Number.isFinite(coalesceChars) ? coalesceChars : undefined,
      })
    }
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
                  id: crypto.randomUUID(),
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: fullText || '...',
                  model: imageBase64 ? visionModel : deepinfraModel,
                  input_tokens: 0,
                  output_tokens: 0,
                  created_at: new Date().toISOString(),
                })
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
                id: crypto.randomUUID(),
                conversation_id: conversationId,
                role: 'assistant',
                content: fullText || '...',
                model: imageBase64 ? visionModel : deepinfraModel,
                input_tokens: 0,
                output_tokens: 0,
                created_at: new Date().toISOString(),
              })
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
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      'X-Tenant-Id': tenantId,
      'X-Bot-Id': bot.id,
      'X-Conversation-Id': conversationId,
    },
  })
}

function errJson(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
