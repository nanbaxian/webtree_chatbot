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
import { expandOssdCourseQuery } from '../../lib/ossd-course-mapper'
import { detectReplyLanguageFromText, getLanguageReplyRule } from '../../lib/reply-language'
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

const CJK_RE = /[\u4e00-\u9fff]/

const CHINESE_RAG_HINTS: Array<{ pattern: RegExp; terms: string }> = [
  { pattern: /(学费|费用|收费|多少钱)/, terms: 'tuition fees cost price' },
  { pattern: /(奖学金|助学金|资助)/, terms: 'scholarships financial aid bursaries' },
  { pattern: /(入学要求|录取要求|招生要求|申请条件)/, terms: 'admission requirements entry requirements' },
  { pattern: /(申请|报考|报名)/, terms: 'apply admission application' },
  { pattern: /(ouac|安省申请中心|安大略大学申请中心)/i, terms: 'OUAC Ontario Universities' },
  { pattern: /(专业|课程|项目|program)/i, terms: 'program major degree course' },
  { pattern: /(计算机科学|电脑科学)/, terms: 'computer science' },
  { pattern: /(商科|商业|工商管理|管理)/, terms: 'business administration commerce management' },
  { pattern: /(工程|工科)/, terms: 'engineering' },
  { pattern: /(护理|护士)/, terms: 'nursing' },
  { pattern: /(心理学|心理)/, terms: 'psychology' },
  { pattern: /(传媒|媒体|传播)/, terms: 'media communication communications' },
  { pattern: /(设计|平面|视觉)/, terms: 'design graphic illustration industrial design' },
  { pattern: /(早教|幼教|儿童发展|儿童教育)/, terms: 'early childhood studies child studies' },
  { pattern: /(国际学生|留学生)/, terms: 'international students' },
  { pattern: /(本地学生|安省学生|加拿大本地学生|国内学生)/, terms: 'Ontario domestic students domestic students' },
  { pattern: /(截止日期|申请截止|deadline)/i, terms: 'deadline due date' },
  { pattern: /(课程|学分|先修|前置)/, terms: 'course credits prerequisites' },
  { pattern: /(实习|co-?op|带薪实习)/i, terms: 'co-op internship placement' },
  { pattern: /(平均分|录取均分|分数线|最低分|竞争均分|competitive average|average)/i, terms: 'admission average competitive average minimum average' },
  { pattern: /(附加费|杂费|ancillary|supplementary fee|student fee)/i, terms: 'ancillary fees student fees supplementary fees' },
  { pattern: /(校园|校区|地址|location|campus)/i, terms: 'campus location address' },
  { pattern: /(课程代码|课号|代码|course code|course codes)/i, terms: 'course code course codes course number' },
  { pattern: /(自然语言|自然描述|家长会问|怎么选课|选什么课|适合)/, terms: 'natural language course selection course recommendation' },
  { pattern: /(数学课|英语课|科学课|商科课|计算机课|艺术课|体育课|法语课)/, terms: 'math english science business computer science arts pe french' },
  { pattern: /(上课时间|课程时间|课表|时间表|什么时候上课|哪天上课|几点上课|上课地点|课程名字|课程名称)/, terms: 'schedule timetable class time course schedule course title course name location' },
  { pattern: /(竞赛|考试|标化|标考|备考|冲刺|入学考试|大学入学考试|英语考试|数学竞赛|编程竞赛|升学考试)/, terms: 'competition contest exam standardized test admissions test prep math contest programming contest english proficiency' },
  { pattern: /(SSAT|SAT|ACT|AP|AMC|AIME|CCC|Euclid|TOEFL|IELTS|Bluebook)/i, terms: 'SSAT SAT ACT AP AMC AIME CCC Euclid TOEFL IELTS' },
  { pattern: /(路径|路线|规划|计划|roadmap|怎么安排|先做什么|先考什么|下一步|之后|升学路径)/, terms: 'path roadmap plan sequence next step strategy' },
  { pattern: /(今年|本年|当年)/, terms: 'this year current year academic year' },
]

function collectChineseQueryHints(query: string): string[] {
  const text = String(query || '')
  if (!CJK_RE.test(text)) return []

  const hints = new Set<string>()
  for (const entry of CHINESE_RAG_HINTS) {
    if (entry.pattern.test(text)) {
      for (const token of entry.terms.split(/\s+/)) {
        const value = token.trim()
        if (value) hints.add(value)
      }
    }
  }

  return [...hints]
}

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

function buildRagSearchQuery(query: string, locale?: ReplyLanguage): string {
  const base = String(query || '').trim()
  if (!base) return base

  if (locale !== 'zh' && !CJK_RE.test(base)) return base

  const hints = collectChineseQueryHints(base)

  if (hints.length === 0) return base

  return `${base} ${hints.join(' ')}`.trim()
}

function normalizeMatchText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildWebtreeDemoDirectAnswer(message: string, language: ReplyLanguage): string | null {
  const text = normalizeMatchText(message)
  if (!text) return null

  const isTuitionQuery = /(?:学费|费用|收费|多少钱|\btuition\b|\bfee\b|\bfees\b)/i.test(text)
  const isScheduleQuery = /(?:上课时间|课程时间|课表|时间表|什么时候上课|哪天上课|几点上课|schedule|timetable|class time|what time|when is class)/i.test(text)
  const isAddressQuery = /(?:地址|位置|哪里|location|campus|where is|where located)/i.test(text)
  const isContactQuery = /(?:电话|邮箱|联系|contact|phone|email)/i.test(text)

  if (language === 'zh') {
    if (isTuitionQuery) {
      return 'Webtree Academy 的 2026-2027 学费是：Grade 7-12 的 domestic tuition 为 $23,000，international tuition 为 $27,000。Elite Program - Academic Enrichment 的学费是 Grade 7-11 $8,800，Grade 12 $10,800。另有 $300 报名费、$1,000 技术/材料/杂费、$2,500 校内活动费，国际学生还有 $730 医疗保险。'
    }
    if (isScheduleQuery) {
      return 'Webtree Academy 的 Grade 9-12 上课时间为：9:00-10:00 第一节，10:00-10:05 休息，10:05-10:55 第二节，10:55-11:05 休息，11:05-12:05 第三节，12:05-12:35 午餐，12:35-1:25 第四节，1:25-1:35 休息，1:35-2:35 第五节，2:35-2:40 休息，2:40-3:30 第六节。'
    }
    if (isAddressQuery) {
      return 'Webtree Academy 的地址是 60 Scarsdale Rd Unit 100, North York, ON M3B 2R7。'
    }
    if (isContactQuery) {
      return 'Webtree Academy 的联系电话是 (416) 792-8280，邮箱是 info@webtreeedu.com。'
    }
    return null
  }

  if (isTuitionQuery) {
    return 'Webtree Academy tuition for 2026-2027 is $23,000 for domestic students in Grades 7-12 and $27,000 for international students in Grades 7-12. The Elite Program - Academic Enrichment is $8,800 for Grades 7-11 and $10,800 for Grade 12, plus a $300 application fee, a $1,000 technology/material/incidental fee, a $2,500 co-curricular fee, and $730 medical insurance for international students.'
  }
  if (isScheduleQuery) {
    return 'Webtree Academy Grade 9-12 schedule is: Period 1 from 9:00 to 10:00, a 5-minute break from 10:00 to 10:05, Period 2 from 10:05 to 10:55, a 10-minute break from 10:55 to 11:05, Period 3 from 11:05 to 12:05, lunch from 12:05 to 12:35, Period 4 from 12:35 to 1:25, a 10-minute break from 1:25 to 1:35, Period 5 from 1:35 to 2:35, a 5-minute break from 2:35 to 2:40, and Period 6 from 2:40 to 3:30.'
  }
  if (isAddressQuery) {
    return 'Webtree Academy is located at 60 Scarsdale Rd Unit 100, North York, ON M3B 2R7.'
  }
  if (isContactQuery) {
    return 'Webtree Academy can be reached at (416) 792-8280 or info@webtreeedu.com.'
  }

  return null
}

function createSseStream(answer: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ text: answer })}\n\n`))
      ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: answer })}\n\n`))
      ctrl.close()
    },
  })
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
  tenantId: string,
  botId: string,
  language: ReplyLanguage,
  ragPromptBlock: string,
  latestUserText: string,
  courseHint?: string,
): string {
  const langRule = getLanguageReplyRule(language)

  const botSettings = parseSettings<Record<string, unknown>>(bot.settings_json, {})
  const maxTurns = typeof botSettings.max_history_turns === 'number' ? botSettings.max_history_turns : 10
  const isWebtreeDemo = tenantId === 'tenant_demo' || botId === 'bot_demo'
  const tenantName = isWebtreeDemo ? 'Webtree Academy' : tenantId

  return [
    `You are ${bot.name} for tenant "${tenantName}".`,
    `Persona: ${bot.persona}`,
    `Tone: ${bot.tone}`,
    `Welcome: ${bot.welcome_msg}`,
    isWebtreeDemo
      ? 'School context: This demo is about Webtree Academy. If the user asks about tuition, fees, schedule, address, admissions, or contact details without naming another school, assume they mean Webtree Academy.'
      : '',
    `Fallback if knowledge is missing:\n- If the answer cannot be verified from the current sources, say so plainly.\n- Tell the user to email the school's contact email at info@webtreeedu.com.\n- Do not invent or guess any other email address.`,
    `Language rules:\n${langRule}`,
    `Conversation policy:\n- Answer directly and concisely.\n- Do not invent knowledge-base facts.\n- Treat retrieved evidence as the source of truth.\n- Prefer exact extraction over paraphrase for schedules, fees, addresses, dates, names, and numbers.\n- If the user asks for a source-backed answer, cite the strongest matching evidence in plain language.\n- If the request is vague and several sources could match, ask one short clarifying question instead of guessing.\n- If there is related evidence but no exact match, say what is supported and what remains ambiguous.\n- If you still cannot verify the answer, tell the user to email info@webtreeedu.com. Do not invent or guess any other email address.`,
    `Reasoning policy:\n- Map colloquial user phrasing to likely KB concepts.\n- For timetable or "what time" questions, search for course names, grades, teachers, days, periods, and time ranges.\n- For location or address questions, look for contact, campus, or map details.\n- For fee questions, look for tuition, registration, and supplemental fee sections.`,
    `Memory policy:\n- Use only the recent conversation history.\n- Respect the configured turn budget of ${maxTurns}.`,
    `Response shape:\n- Start with the answer.\n- Add a brief caveat only if needed.\n- Never say "I could not find" when the retrieved sources are semantically related; instead, give the closest supported answer and note the ambiguity.\n- When the answer still cannot be verified, end with a short instruction to contact info@webtreeedu.com.`,
    `OSSD normalization policy:\n- If a course mapping hint is present, treat it as authoritative for Ontario course-code normalization.\n- When the hint lists candidate course codes, answer with those codes first even if the retrieved knowledge does not explicitly mention them.\n- Only say the course needs clarification when the hint explicitly says to clarify or the user's phrase is too generic to map safely.\n- Use retrieval for school-specific availability, schedule, teacher, and prerequisite details after naming the course code.`,
    `If the course mapping hint says the query needs clarification, ask one short follow-up question before answering.`,
    courseHint ? `Course mapping hint:\n${courseHint}` : '',
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

  try {
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
  const replyLanguage: ReplyLanguage = detectReplyLanguageFromText(
    message,
    body.replyLanguage === 'en' ? 'en' : 'zh',
  )
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
  const ossdCourse = expandOssdCourseQuery(message)
  const ragQuery = buildRagSearchQuery(ossdCourse?.searchQuery || message, replyLanguage)

  const ragStartedAt = Date.now()
  const rag = await loadRagContext(env, tenantId, bot.id, ragQuery, 8, reqId, conversationKey, replyLanguage)
  const ragLatencyMs = Date.now() - ragStartedAt
  await saveRetrievalLog(env, tenantId, bot.id, message, rag.chunks, ragLatencyMs)
  const citations = selectRagCitations(rag.chunks, 3)
  const citationsHeader = serializeRagCitationsHeader(citations)
  const assistantMessageId = crypto.randomUUID()

  const isWebtreeDemo = tenantId === 'tenant_demo' || bot.id === 'bot_demo'
  const directAnswer = isWebtreeDemo
    ? buildWebtreeDemoDirectAnswer(message, replyLanguage)
    : null
  if (directAnswer) {
    if (env.DB) {
      await insertMessage(env, {
        id: assistantMessageId,
        conversation_id: conversationId,
        role: 'assistant',
        content: directAnswer,
        model: 'direct-fallback',
        input_tokens: 0,
        output_tokens: 0,
        created_at: new Date().toISOString(),
      })
    }
    void saveUsage(env, tenantId, bot.id, new Date().toISOString().slice(0, 10), message.length, directAnswer.length)
    apiLog.ok({
      tenantId,
      botId: bot.id,
      conversationId,
      title: conversationTitle,
      fullLen: directAnswer.length,
      source: 'direct-fallback',
    })
    return new Response(createSseStream(directAnswer), {
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

  const systemPrompt = buildSystemPrompt(bot, tenantId, bot.id, replyLanguage, rag.promptBlock, message, ossdCourse?.promptHint)
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
  const openaiModel = env.OPENAI_MODEL || 'gpt-4.1'
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
  } catch (error) {
    const stack = error instanceof Error ? error.stack : String(error)
    console.error(`[knowledgeos:chat ${reqId}] unhandled_error`, stack)
    apiLog.fail(error, { stage: 'unhandled', stack })
    return errJson('Server error, please try again.', 500)
  }
}

function errJson(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
