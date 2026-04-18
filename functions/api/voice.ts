// functions/api/voice.ts
// POST /api/voice  — STT (Deepgram)
// GET  /api/voice?text=xxx  — TTS (Free: Google TTS | Pro: ElevenLabs)
//
// ✅ 本版改造：按 Supabase Auth 的 user_id 计费/限额
// - Free：每日 10 分钟（KV 记录 used seconds，key = voice:{userId}:{YYYY-MM-DD}）
// - Pro ：默认不限制（从 Supabase 表 user_plans 读取）
//
// 认证：
// - 必须携带 Authorization: Bearer <supabase access_token>
// - 后端使用 JWKS 验签（/auth/v1/certs）

import { verifySupabaseJwt } from '@/lib/auth'
import { getUserPlan } from '@/lib/plan'
import { quotaKey, getUsedSeconds, addUsedSeconds, FREE_DAILY_SECONDS } from '@/lib/voice-quota'
import { createApiLogger } from '@/lib/api-log'

interface Env {
  BUCKET: R2Bucket

  // Free tier
  DEEPGRAM_API_KEY: string
  GOOGLE_TTS_API_KEY: string
  DEEPGRAM_TTS_MODEL_EN?: string
  DEEPGRAM_TTS_MODEL_ZH?: string

  // Pro tier
  ELEVENLABS_API_KEY?: string
  ELEVENLABS_VOICE_ID?: string

  // Supabase
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_JWT_ISS?: string
  SUPABASE_JWT_AUD?: string

  // Quota storage
  VOICE_KV: KVNamespace
}

type SttLanguage = 'zh' | 'en'
type VoiceLanguage = 'zh' | 'en'
type TtsProvider = 'deepgram' | 'elevenlabs' | 'google'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-audio-duration-ms',
}

function jsonError(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function withQuotaHeaders(resp: Response, plan: 'free' | 'pro', remaining?: number, provider?: TtsProvider): Response {
  const h = new Headers(resp.headers)
  h.set('Access-Control-Allow-Origin', cors['Access-Control-Allow-Origin'])
  h.set('X-Voice-Plan', plan)
  if (typeof remaining === 'number') h.set('X-Voice-Remaining-Seconds', String(remaining))
  if (provider) h.set('X-Voice-Provider', provider)
  return new Response(resp.body, { status: resp.status, headers: h })
}

function extractR2KeyFromUrl(audioUrl: string): string | null {
  let path = audioUrl
  try {
    if (/^https?:\/\//i.test(audioUrl)) path = new URL(audioUrl).pathname
  } catch {
    return null
  }
  const m = path.match(/^\/r2\/([^/?#]+)$/)
  return m?.[1] ?? null
}

function extractDeepgramTranscript(dgJson: any): string {
  const alt = dgJson?.results?.channels?.[0]?.alternatives?.[0]
  const direct = String(alt?.transcript ?? '').trim()
  if (direct) return direct

  const words = Array.isArray(alt?.words) ? alt.words : []
  if (words.length > 0) {
    const byWords = words
      .map((w: any) => String(w?.punctuated_word ?? w?.word ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .trim()
    if (byWords) return byWords
  }

  const utterances = Array.isArray(dgJson?.results?.utterances) ? dgJson.results.utterances : []
  if (utterances.length > 0) {
    const byUtterances = utterances
      .map((u: any) => String(u?.transcript ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .trim()
    if (byUtterances) return byUtterances
  }

  return ''
}

function getDeepgramDetectedLanguage(dgJson: any): string {
  return String(
    dgJson?.results?.channels?.[0]?.detected_language ??
    dgJson?.results?.channels?.[0]?.alternatives?.[0]?.languages?.[0] ??
    ''
  ).trim()
}

function normalizeSttLanguage(v: unknown): SttLanguage {
  if (v === 'zh' || v === 'en') return v
  return 'zh'
}

function normalizeVoiceLanguage(v: unknown): VoiceLanguage {
  if (v === 'zh' || v === 'en') return v
  return 'zh'
}

function normalizeTtsProvider(v: unknown): TtsProvider {
  if (v === 'deepgram' || v === 'elevenlabs' || v === 'google') return v
  return 'deepgram'
}

// ================================================
// POST /api/voice — 语音转文字（Deepgram）
// ================================================
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  const log = createApiLogger('voice:post', ctx)
  log.start({ contentType: request.headers.get('content-type') || 'unknown' })

  // Auth required
  let userId = ''
  try {
    const u = await verifySupabaseJwt(request, env)
    userId = u.userId
    log.info('auth:ok', { userId })
  } catch (e) {
    log.fail(e, { stage: 'auth' })
    return jsonError('未登录：请使用 Magic Link 登录后再试', 401)
  }

  const plan = await getUserPlan(env, userId)
  const key = quotaKey(userId)

  const ct = request.headers.get('content-type') || ''
  let audioArrayBuffer: ArrayBuffer | null = null
  let durationSeconds = 0
  let mimeType = 'audio/webm'
  let audioSource: 'r2' | 'multipart' = 'multipart'
  let sttLanguage: SttLanguage = 'zh'

  if (ct.includes('application/json')) {
    audioSource = 'r2'
    const body = await request.json().catch(() => null as any)
    const audioUrl = body?.audioUrl as string | undefined
    durationSeconds = Number(body?.durationSeconds || 0)
    sttLanguage = normalizeSttLanguage(body?.replyLanguage)

    if (!audioUrl) {
      log.fail('missing audioUrl', { stage: 'validate', userId })
      return jsonError('缺少 audioUrl', 400)
    }
    const r2Key = extractR2KeyFromUrl(audioUrl)
    if (!r2Key) {
      log.fail('invalid audioUrl format', { stage: 'validate', userId })
      return jsonError('audioUrl 格式不正确', 400)
    }
    const obj = await env.BUCKET.get(r2Key)
    if (!obj) {
      log.fail('audio not found in r2', { stage: 'r2:get', userId, key: r2Key })
      return jsonError('音频不存在', 404)
    }
    audioArrayBuffer = await obj.arrayBuffer()
    mimeType = obj.httpMetadata?.contentType || mimeType
  } else {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (e) {
      log.fail(e, { stage: 'parse', userId })
      return jsonError('请求格式错误，需要 multipart/form-data 或 application/json', 400)
    }
    const audioFile = formData.get('audio') as File | null
    if (!audioFile) {
      log.fail('missing audio file', { stage: 'validate', userId })
      return jsonError('未收到音频文件', 400)
    }
    const durationMs = Number(request.headers.get('x-audio-duration-ms') || 0)
    durationSeconds = Math.ceil(Math.max(1, durationMs) / 1000)
    audioArrayBuffer = await audioFile.arrayBuffer()
    mimeType = audioFile.type || mimeType
  }

  // Free 配额检查
  let remaining = 0
  if (plan === 'free') {
    const used = await getUsedSeconds(env.VOICE_KV, key)
    remaining = Math.max(0, FREE_DAILY_SECONDS - used)
    if (remaining <= 0) {
      log.fail('quota exceeded', { stage: 'quota', userId, plan })
      return withQuotaHeaders(jsonError('今日语音体验已用完（免费用户每日 10 分钟）', 402), plan, 0)
    }
  }

  // 计费时长：优先使用前端上报/JSON 里的 durationSeconds，否则按 30s 估算
  const audioSeconds = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? Math.min(600, Math.max(1, Math.ceil(durationSeconds))) // 单次最多计 10 分钟
    : 30

  // Deepgram ASR
  const dgUrl = new URL('https://api.deepgram.com/v1/listen')
  dgUrl.searchParams.set('model', 'nova-2')
  dgUrl.searchParams.set('smart_format', 'true')
  dgUrl.searchParams.set('punctuate', 'true')
  if (sttLanguage === 'zh') dgUrl.searchParams.set('language', 'zh')
  if (sttLanguage === 'en') dgUrl.searchParams.set('language', 'en')
  dgUrl.searchParams.set('utterances', 'true')
  dgUrl.searchParams.set('filler_words', 'false')
  log.info('deepgram:request', {
    userId,
    plan,
    source: audioSource,
    mimeType,
    bytes: audioArrayBuffer?.byteLength || 0,
    audioSeconds,
    model: 'nova-2',
    requestedLanguage: sttLanguage,
    language: sttLanguage,
    detectLanguage: false,
    utterances: true,
  })

  const dgRes = await fetch(dgUrl.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      'Content-Type': mimeType,
    },
    body: audioArrayBuffer as any,
  })

  if (!dgRes.ok) {
    const body = await dgRes.text()
    console.error('[deepgram]', body)
    log.fail('deepgram failed', {
      stage: 'stt',
      userId,
      plan,
      status: dgRes.status,
      statusText: dgRes.statusText,
      requestId: dgRes.headers.get('x-request-id') || dgRes.headers.get('dg-request-id') || '',
      bodyPreview: body.slice(0, 400),
    })
    return jsonError('语音识别失败', 500)
  }

  const dgJson = await dgRes.json() as any
  const alt = dgJson?.results?.channels?.[0]?.alternatives?.[0]
  const wordsCount = Array.isArray(alt?.words) ? alt.words.length : 0
  const utterancesCount = Array.isArray(dgJson?.results?.utterances) ? dgJson.results.utterances.length : 0
  const directTranscript = String(alt?.transcript ?? '').trim()
  const detectedLanguage = getDeepgramDetectedLanguage(dgJson)
  log.info('deepgram:response', {
    userId,
    plan,
    status: dgRes.status,
    requestId: dgRes.headers.get('x-request-id') || dgRes.headers.get('dg-request-id') || '',
    metadataDuration: Number(dgJson?.metadata?.duration || 0),
    channels: Array.isArray(dgJson?.results?.channels) ? dgJson.results.channels.length : 0,
    wordsCount,
    utterancesCount,
    detectedLanguage,
    directTranscriptLen: directTranscript.length,
    directTranscriptPreview: directTranscript.slice(0, 80),
  })
  const text = extractDeepgramTranscript(dgJson)

  // 计费：free 扣配额
  if (plan === 'free') {
    const r = await addUsedSeconds(env.VOICE_KV, key, audioSeconds)
    remaining = r.remaining
  }

  if (!text) {
    log.fail('empty transcript', {
      stage: 'stt-empty',
      userId,
      plan,
      audioSeconds,
      mimeType,
      bytes: audioArrayBuffer?.byteLength || 0,
      wordsCount,
      utterancesCount,
    })
    return withQuotaHeaders(jsonError('未识别到语音内容，请重试或录制更清晰音频', 422), plan, plan === 'free' ? remaining : undefined)
  }

  const res = new Response(JSON.stringify({ text }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
  log.ok({ userId, plan, transcriptLen: text.length })
  return withQuotaHeaders(res, plan, plan === 'free' ? remaining : undefined)
}

// ================================================
// GET /api/voice?text=xxx — 文字转语音
// Free：Google TTS
// Pro ：ElevenLabs
// ================================================
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  const log = createApiLogger('voice:get', ctx)
  log.start()

  // Auth required
  let userId = ''
  try {
    const u = await verifySupabaseJwt(request, env)
    userId = u.userId
    log.info('auth:ok', { userId })
  } catch (e) {
    log.fail(e, { stage: 'auth' })
    return jsonError('未登录：请使用 Magic Link 登录后再试', 401)
  }

  const plan = await getUserPlan(env, userId)
  const key = quotaKey(userId)

  const u = new URL(request.url)
  const text = u.searchParams.get('text')
  const voiceLanguage = normalizeVoiceLanguage(u.searchParams.get('lang'))
  const requestedProvider = normalizeTtsProvider(u.searchParams.get('provider'))
  if (!text) {
    log.fail('missing text', { stage: 'validate', userId })
    return jsonError('text 参数不能为空', 400)
  }
  const resolvedVoiceLanguage = voiceLanguage
  const googleLanguageCode = resolvedVoiceLanguage === 'zh' ? 'cmn-CN' : 'en-US'

  // Free 配额检查
  let remaining = 0
  if (plan === 'free') {
    const used = await getUsedSeconds(env.VOICE_KV, key)
    remaining = Math.max(0, FREE_DAILY_SECONDS - used)
    if (remaining <= 0) {
      log.fail('quota exceeded', { stage: 'quota', userId, plan })
      return withQuotaHeaders(jsonError('今日语音体验已用完（免费用户每日 10 分钟）', 402), plan, 0)
    }
  }

  // 估算 TTS 时长：900 chars / min
  const chars = text.length
  const estSeconds = Math.max(1, Math.min(180, Math.ceil((chars / 900) * 60)))

  const chargeQuota = async () => {
    if (plan === 'free') {
      const r = await addUsedSeconds(env.VOICE_KV, key, estSeconds)
      remaining = r.remaining
    }
  }

  // Provider: Deepgram Aura
  if (requestedProvider === 'deepgram') {
    const dgModel = resolvedVoiceLanguage === 'zh'
      ? String(env.DEEPGRAM_TTS_MODEL_ZH || '').trim()
      : String(env.DEEPGRAM_TTS_MODEL_EN || 'aura-2-thalia-en').trim()
    if (!dgModel) {
      log.fail('missing deepgram tts model for language', {
        stage: 'tts',
        userId,
        plan,
        provider: 'deepgram',
        resolvedVoiceLanguage,
      })
      return jsonError(
        resolvedVoiceLanguage === 'zh'
          ? '缺少 DEEPGRAM_TTS_MODEL_ZH，请配置后再使用 Deepgram 中文 TTS'
          : '缺少 DEEPGRAM_TTS_MODEL_EN，请配置后再使用 Deepgram 英文 TTS',
        500
      )
    } else {
      const dgUrl = new URL('https://api.deepgram.com/v1/speak')
      dgUrl.searchParams.set('model', dgModel)
      dgUrl.searchParams.set('encoding', 'mp3')
      const dgStartedAt = Date.now()
      log.info('deepgram-tts:request', {
        userId,
        plan,
        chars,
        estSeconds,
        requestedLanguage: voiceLanguage,
        resolvedLanguage: resolvedVoiceLanguage,
        model: dgModel,
      })
      const dgRes = await fetch(dgUrl.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text: text.slice(0, 1200) }),
      })
      log.info('deepgram-tts:response', {
        userId,
        plan,
        status: dgRes.status,
        ok: dgRes.ok,
        latencyMs: Date.now() - dgStartedAt,
        requestId: dgRes.headers.get('dg-request-id') || dgRes.headers.get('x-request-id') || '',
        contentType: dgRes.headers.get('content-type') || '',
      })
      if (dgRes.ok) {
        await chargeQuota()
        const resp = new Response(dgRes.body, {
          headers: {
            ...cors,
            'Content-Type': dgRes.headers.get('content-type') || 'audio/mpeg',
            'Cache-Control': 'no-store',
          },
        })
        log.ok({ userId, plan, provider: 'deepgram', chars })
        return withQuotaHeaders(resp, plan, plan === 'free' ? remaining : undefined, 'deepgram')
      }
      const dgBody = await dgRes.text()
      console.error('[deepgram tts]', dgBody)
      log.fail('deepgram tts failed', {
        stage: 'tts',
        userId,
        plan,
        provider: 'deepgram',
        status: dgRes.status,
        bodyPreview: dgBody.slice(0, 400),
      })
      return jsonError('语音合成失败（Deepgram）', 500)
    }
  }

  // Provider: ElevenLabs
  if (requestedProvider === 'elevenlabs') {
    if (!env.ELEVENLABS_API_KEY) {
      log.fail('missing ELEVENLABS_API_KEY', { stage: 'tts', userId, plan, provider: 'elevenlabs' })
      return jsonError('缺少 ELEVENLABS_API_KEY', 500)
    }
    const voiceId = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // ElevenLabs 常用默认
    const elUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`
    const elStartedAt = Date.now()
    log.info('elevenlabs:request', {
      userId,
      plan,
      voiceId,
      model: 'eleven_multilingual_v2',
      requestedLanguage: voiceLanguage,
      resolvedLanguage: resolvedVoiceLanguage,
      chars,
      estSeconds,
    })
    const elRes = await fetch(elUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 1200),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    })
    log.info('elevenlabs:response', {
      userId,
      plan,
      status: elRes.status,
      ok: elRes.ok,
      latencyMs: Date.now() - elStartedAt,
      requestId: elRes.headers.get('x-request-id') || elRes.headers.get('request-id') || '',
      contentType: elRes.headers.get('content-type') || '',
    })

    if (elRes.ok) {
      await chargeQuota()
      const resp = new Response(elRes.body, {
        headers: {
          ...cors,
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
        },
      })
      log.ok({ userId, plan, provider: 'elevenlabs', chars })
      return withQuotaHeaders(resp, plan, plan === 'free' ? remaining : undefined, 'elevenlabs')
    }

    const elBody = await elRes.text()
    console.error('[elevenlabs]', elBody)
    log.fail('elevenlabs failed', {
      stage: 'tts',
      userId,
      plan,
      provider: 'elevenlabs',
      status: elRes.status,
      bodyPreview: elBody.slice(0, 400),
    })
    return jsonError('语音合成失败（ElevenLabs）', 500)
  }

  // Provider: Google TTS
  if (requestedProvider === 'google') {
    const ggUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`
    const ggStartedAt = Date.now()
    log.info('google-tts:request', {
      userId,
      plan,
      chars,
      estSeconds,
      requestedLanguage: voiceLanguage,
      resolvedLanguage: resolvedVoiceLanguage,
      languageCode: googleLanguageCode,
      audioEncoding: 'MP3',
    })
    const ggRes = await fetch(ggUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.slice(0, 1200) },
        voice: {
          languageCode: googleLanguageCode,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
        },
      }),
    })
    log.info('google-tts:response', {
      userId,
      plan,
      status: ggRes.status,
      ok: ggRes.ok,
      latencyMs: Date.now() - ggStartedAt,
      requestId: ggRes.headers.get('x-request-id') || ggRes.headers.get('request-id') || '',
      contentType: ggRes.headers.get('content-type') || '',
    })

    if (!ggRes.ok) {
      const ggBody = await ggRes.text()
      console.error('[google tts]', ggBody)
      log.fail('google tts failed', {
        stage: 'tts',
        userId,
        plan,
        provider: 'google',
        status: ggRes.status,
        bodyPreview: ggBody.slice(0, 400),
      })
      return jsonError('语音合成失败（Google）', 500)
    } else {
      const ggJson = await ggRes.json() as { audioContent?: string }
      const b64 = ggJson.audioContent
      log.info('google-tts:parsed', {
        userId,
        plan,
        hasAudioContent: Boolean(b64),
        audioContentLen: b64?.length || 0,
      })
      if (!b64) {
        log.fail('google tts empty audioContent', { stage: 'tts', userId, plan, provider: 'google' })
        return jsonError('语音合成失败（Google 空返回）', 500)
      } else {
        await chargeQuota()
        const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
        const resp = new Response(bin, {
          headers: {
            ...cors,
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'no-store',
          },
        })
        log.ok({ userId, plan, provider: 'google', chars })
        return withQuotaHeaders(resp, plan, plan === 'free' ? remaining : undefined, 'google')
      }
    }
  }

  log.fail('unsupported provider', {
    stage: 'tts',
    userId,
    plan,
    requestedProvider,
    resolvedVoiceLanguage,
  })
  return jsonError('不支持的 TTS provider', 400)
}

export const onRequestOptions = (): Response => new Response(null, { headers: cors })
