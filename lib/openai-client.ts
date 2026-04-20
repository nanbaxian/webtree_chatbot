// lib/openai-client.ts
// OpenAI Chat Completions adapter for Workers / Pages runtime.

export interface OpenAIMessage {
  role: 'user' | 'assistant'
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
}

interface StreamDebugOptions {
  debug?: boolean
  reqId?: string
  model?: string
  maxOutputTokens?: number
  coalesceChars?: number
  orgId?: string
  projectId?: string
}

interface OpenAIContentTextPart {
  type: 'text'
  text: string
}

interface OpenAIContentImagePart {
  type: 'image_url'
  image_url: { url: string }
}

type OpenAIContentPart = OpenAIContentTextPart | OpenAIContentImagePart

interface OpenAIRequestMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | OpenAIContentPart[]
}

function getHeader(h: Headers, name: string): string {
  return h.get(name) || ''
}

function mapToOpenAIRequestMessages(messages: OpenAIMessage[], systemPrompt: string): OpenAIRequestMessage[] {
  const mapped: OpenAIRequestMessage[] = [{ role: 'system', content: systemPrompt }]
  for (const m of messages) {
    const role: OpenAIRequestMessage['role'] = m.role === 'assistant' ? 'assistant' : 'user'
    const contentParts: OpenAIContentPart[] = []
    const textParts: string[] = []
    for (const part of m.parts) {
      if ('text' in part && typeof part.text === 'string') {
        textParts.push(part.text)
      } else if ('inlineData' in part && part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/jpeg'
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${part.inlineData.data}` },
        })
      }
    }

    if (contentParts.length === 0) {
      mapped.push({ role, content: textParts.join('\n').trim() || ' ' })
    } else {
      if (textParts.length > 0) {
        contentParts.unshift({ type: 'text', text: textParts.join('\n').trim() })
      }
      mapped.push({ role, content: contentParts })
    }
  }
  return mapped
}

function extractDeltaText(parsed: unknown): string {
  const delta = (parsed as { choices?: Array<{ delta?: { content?: unknown } }> })?.choices?.[0]?.delta?.content
  if (typeof delta === 'string') return delta
  if (!Array.isArray(delta)) return ''

  return delta
    .map((p: unknown) => {
      const text = (p as { type?: string; text?: string }).text
      const type = (p as { type?: string }).type
      return type === 'text' && typeof text === 'string' ? text : ''
    })
    .filter(Boolean)
    .join('')
}

function extractMessageText(parsed: unknown): string {
  const content = (parsed as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((p: unknown) => {
      const text = (p as { type?: string; text?: string }).text
      const type = (p as { type?: string }).type
      return type === 'text' && typeof text === 'string' ? text : ''
    })
    .filter(Boolean)
    .join('')
}

async function postOpenAIChat(
  apiKey: string,
  payload: Record<string, unknown>,
  debugLabel: string,
  reqId: string,
  startedAt: number,
  authHeaders: { orgId?: string; projectId?: string } = {},
) {
  const url = 'https://api.openai.com/v1/chat/completions'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  if (authHeaders.orgId) headers['OpenAI-Organization'] = authHeaders.orgId
  if (authHeaders.projectId) headers['OpenAI-Project'] = authHeaders.projectId
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (debugLabel) {
    console.log(
      `[openai ${reqId}] upstream status=${res.status} ok=${res.ok} ` +
      `fetch_ms=${Date.now() - startedAt} ` +
      `req_header_id=${getHeader(res.headers, 'x-request-id') || getHeader(res.headers, 'request-id')} ` +
      `content_type=${getHeader(res.headers, 'content-type')}`
    )
  }

  return res
}

export async function streamOpenAIChat(
  apiKey: string,
  systemPrompt: string,
  messages: OpenAIMessage[],
  opts: StreamDebugOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const debug = opts.debug === true
  const reqId = opts.reqId ?? 'na'
  const startedAt = Date.now()
  const model = opts.model ?? 'gpt-4.1'
  const maxOutputTokens = Math.max(64, Math.min(32768, opts.maxOutputTokens ?? 300))
  const coalesceChars = Math.max(4, Math.min(64, opts.coalesceChars ?? 12))

  if (debug) {
    const inputChars = messages
      .flatMap(m => m.parts)
      .reduce((n, p) => n + ('text' in p && typeof p.text === 'string' ? p.text.length : 0), 0)
    const imageParts = messages
      .flatMap(m => m.parts)
      .filter(p => 'inlineData' in p && Boolean(p.inlineData?.data)).length
    console.log(
      `[openai ${reqId}] start model=${model} max_tokens=${maxOutputTokens} coalesce=${coalesceChars} ` +
      `msg_count=${messages.length} input_chars=${inputChars} image_parts=${imageParts} system_chars=${systemPrompt.length}`
    )
  }

  const upstream = await postOpenAIChat(
    apiKey,
    {
      model,
      stream: true,
      temperature: 0.35,
      max_tokens: maxOutputTokens,
      messages: mapToOpenAIRequestMessages(messages, systemPrompt),
    },
    'openai',
    reqId,
    startedAt,
    { orgId: opts.orgId, projectId: opts.projectId },
  )

  const encoder = new TextEncoder()

  if (!upstream.ok) {
    const err = await upstream.text()
    if (debug) {
      console.error(`[openai ${reqId}] upstream error body=${err.slice(0, 600)}`)
    }
    return new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err })}\n\n`))
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: '' })}\n\n`))
        ctrl.close()
      },
    })
  }

  if (!upstream.body) {
    if (debug) console.error(`[openai ${reqId}] upstream body is null`)
    return new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'upstream body is empty' })}\n\n`))
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: '' })}\n\n`))
        ctrl.close()
      },
    })
  }

  let fullText = ''
  let doneSent = false
  let lineBuffer = ''
  let eventCount = 0
  let parseErrorCount = 0
  let emitCount = 0
  let firstTokenAt = 0
  let pendingText = ''

  const emitText = (ctrl: TransformStreamDefaultController<Uint8Array>, force = false) => {
    if (!pendingText) return
    const shouldFlushByPunc = /[\uFF0C\u3002\uFF01\uFF1F,.!?;\uFF1B:\uFF1A\n]$/.test(pendingText)
    if (force || pendingText.length >= coalesceChars || shouldFlushByPunc) {
      emitCount += 1
      if (debug && (emitCount <= 3 || force)) {
        console.log(`[openai ${reqId}] emit #${emitCount} chars=${pendingText.length} force=${force}`)
      }
      ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ text: pendingText })}\n\n`))
      pendingText = ''
    }
  }

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      lineBuffer += new TextDecoder().decode(chunk)
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw) continue
        if (raw === '[DONE]') {
          if (!doneSent) {
            doneSent = true
            if (!fullText) {
              const fallbackMsg = 'I could not generate a response. Please try again.'
              fullText = fallbackMsg
              pendingText += fallbackMsg
            }
            emitText(ctrl, true)
            ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`))
            if (debug) {
              console.log(
                `[openai ${reqId}] done via [DONE] full_len=${fullText.length} events=${eventCount} ` +
                `emits=${emitCount} parse_errors=${parseErrorCount} total_ms=${Date.now() - startedAt}`
              )
            }
          }
          continue
        }

        try {
          eventCount += 1
          const parsed = JSON.parse(raw)
          const piece = extractDeltaText(parsed)
          if (piece) {
            if (!firstTokenAt) {
              firstTokenAt = Date.now()
              if (debug) console.log(`[openai ${reqId}] first_token_ms=${firstTokenAt - startedAt}`)
            }
            fullText += piece
            pendingText += piece
            emitText(ctrl)
          }
          const finishReason =
            (parsed as { choices?: Array<{ finish_reason?: string }> })?.choices?.[0]?.finish_reason ?? ''
          if (debug && (eventCount <= 3 || finishReason)) {
            console.log(
              `[openai ${reqId}] event=${eventCount} piece_len=${piece.length} finish=${finishReason || 'none'}`
            )
          }
          if (finishReason && !doneSent) {
            doneSent = true
            if (!fullText) {
              const fallbackMsg = 'I could not generate a response. Please try again.'
              fullText = fallbackMsg
              pendingText += fallbackMsg
            }
            emitText(ctrl, true)
            ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`))
            if (debug) {
              console.log(
                `[openai ${reqId}] done via finish_reason=${finishReason} full_len=${fullText.length} ` +
                `events=${eventCount} emits=${emitCount} parse_errors=${parseErrorCount} total_ms=${Date.now() - startedAt}`
              )
            }
          }
        } catch {
          parseErrorCount += 1
        }
      }
    },
    flush(ctrl) {
      if (!doneSent) {
        if (!fullText) {
          const fallbackMsg = 'I could not generate a response. Please try again.'
          fullText = fallbackMsg
          pendingText += fallbackMsg
        }
        emitText(ctrl, true)
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`))
        if (debug) {
          console.log(
            `[openai ${reqId}] done via flush full_len=${fullText.length} events=${eventCount} ` +
            `emits=${emitCount} parse_errors=${parseErrorCount} total_ms=${Date.now() - startedAt}`
          )
        }
      }
    },
  })

  return upstream.body.pipeThrough(transform)
}

export async function completeOpenAIChat(
  apiKey: string,
  prompt: string,
  opts: { debug?: boolean; reqId?: string; model?: string; maxOutputTokens?: number } = {}
): Promise<string> {
  const debug = opts.debug === true
  const reqId = opts.reqId ?? 'na'
  const startedAt = Date.now()
  const model = opts.model ?? 'gpt-4.1'
  const maxOutputTokens = Math.max(64, Math.min(32768, opts.maxOutputTokens ?? 800))

  if (debug) {
    console.log(`[openai ${reqId}] completion start model=${model} prompt_chars=${prompt.length}`)
  }

  const res = await postOpenAIChat(
    apiKey,
    {
      model,
      stream: false,
      temperature: 0.2,
      max_tokens: maxOutputTokens,
      messages: [{ role: 'user', content: prompt }],
    },
    'openai',
    reqId,
    startedAt,
    { orgId: opts.orgId, projectId: opts.projectId },
  )

  if (!res.ok) {
    const err = await res.text()
    if (debug) {
      console.error(`[openai ${reqId}] completion error body=${err.slice(0, 600)}`)
    }
    throw new Error(`OpenAI ${res.status}: ${err}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: unknown } }> }
  const text = extractMessageText(data)
  if (debug) {
    console.log(`[openai ${reqId}] completion done output_chars=${text.length} total_ms=${Date.now() - startedAt}`)
  }
  return text
}
