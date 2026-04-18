// lib/gemini-client.ts
// DeepInfra OpenAI-compatible chat streaming adapter for Workers runtime.

export interface GeminiMessage {
  role: 'user' | 'model'
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
}

interface StreamDebugOptions {
  debug?: boolean
  reqId?: string
  model?: string
  maxOutputTokens?: number
  coalesceChars?: number
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

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | OpenAIContentPart[]
}

interface GooglePartText {
  text: string
}

interface GooglePartInlineData {
  inlineData: { mimeType: string; data: string }
}

type GooglePart = GooglePartText | GooglePartInlineData

interface GoogleContent {
  role: 'user' | 'model'
  parts: GooglePart[]
}

function getHeader(h: Headers, name: string): string {
  return h.get(name) || ''
}

function mapGeminiToOpenAI(messages: GeminiMessage[], systemPrompt: string): OpenAIMessage[] {
  const mapped: OpenAIMessage[] = [{ role: 'system', content: systemPrompt }]
  for (const m of messages) {
    const role: OpenAIMessage['role'] = m.role === 'model' ? 'assistant' : 'user'
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

function mapGeminiToGoogleContents(messages: GeminiMessage[]): GoogleContent[] {
  return messages.map(m => ({
    role: m.role,
    parts: m.parts.map(part => {
      if ('text' in part) return { text: part.text } as GooglePartText
      return {
        inlineData: {
          mimeType: part.inlineData.mimeType || 'image/jpeg',
          data: part.inlineData.data,
        },
      } as GooglePartInlineData
    }),
  }))
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

function extractGeminiChunkText(parsed: unknown): string {
  const candidates = (parsed as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates
  if (!Array.isArray(candidates) || !candidates[0]?.content?.parts) return ''
  return candidates[0].content.parts
    .map(p => (typeof p?.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('')
}

export async function streamGemini(
  apiKey: string,
  systemPrompt: string,
  messages: GeminiMessage[],
  opts: StreamDebugOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const debug = opts.debug === true
  const reqId = opts.reqId ?? 'na'
  const startedAt = Date.now()
  const model = opts.model ?? 'meta-llama/Llama-3.2-3B-Instruct'
  const maxOutputTokens = Math.max(64, Math.min(1024, opts.maxOutputTokens ?? 300))
  const coalesceChars = Math.max(4, Math.min(64, opts.coalesceChars ?? 12))
  const url = 'https://api.deepinfra.com/v1/openai/chat/completions'
  const payload = {
    model,
    stream: true,
    temperature: 0.35,
    max_tokens: maxOutputTokens,
    messages: mapGeminiToOpenAI(messages, systemPrompt),
  }
  if (debug) {
    const inputChars = messages
      .flatMap(m => m.parts)
      .reduce((n, p) => n + ('text' in p && typeof p.text === 'string' ? p.text.length : 0), 0)
    const imageParts = messages
      .flatMap(m => m.parts)
      .filter(p => 'inlineData' in p && Boolean(p.inlineData?.data)).length
    console.log(
      `[deepinfra ${reqId}] start model=${model} max_tokens=${maxOutputTokens} coalesce=${coalesceChars} ` +
      `msg_count=${messages.length} input_chars=${inputChars} image_parts=${imageParts} system_chars=${systemPrompt.length}`
    )
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  const encoder = new TextEncoder()
  if (debug) {
    console.log(
      `[deepinfra ${reqId}] upstream status=${upstream.status} ok=${upstream.ok} ` +
      `fetch_ms=${Date.now() - startedAt} ` +
      `req_header_id=${getHeader(upstream.headers, 'x-request-id') || getHeader(upstream.headers, 'request-id')} ` +
      `content_type=${getHeader(upstream.headers, 'content-type')}`
    )
  }

  if (!upstream.ok) {
    const err = await upstream.text()
    if (debug) {
      console.error(`[deepinfra ${reqId}] upstream error body=${err.slice(0, 600)}`)
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
    if (debug) console.error(`[deepinfra ${reqId}] upstream body is null`)
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
        console.log(`[deepinfra ${reqId}] emit #${emitCount} chars=${pendingText.length} force=${force}`)
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
                `[deepinfra ${reqId}] done via [DONE] full_len=${fullText.length} events=${eventCount} ` +
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
              if (debug) {
                console.log(`[deepinfra ${reqId}] first_token_ms=${firstTokenAt - startedAt}`)
              }
            }
            fullText += piece
            pendingText += piece
            emitText(ctrl)
          }

          const finishReason =
            (parsed as { choices?: Array<{ finish_reason?: string }> })?.choices?.[0]?.finish_reason ?? ''
          if (debug && (eventCount <= 3 || finishReason)) {
            console.log(
              `[deepinfra ${reqId}] event=${eventCount} piece_len=${piece.length} finish=${finishReason || 'none'}`
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
                `[deepinfra ${reqId}] done via finish_reason=${finishReason} full_len=${fullText.length} ` +
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
            `[deepinfra ${reqId}] done via flush full_len=${fullText.length} events=${eventCount} ` +
            `emits=${emitCount} parse_errors=${parseErrorCount} total_ms=${Date.now() - startedAt}`
          )
        }
      }
    },
  })

  return upstream.body.pipeThrough(transform)
}

export async function streamGeminiFlashLite(
  apiKey: string,
  systemPrompt: string,
  messages: GeminiMessage[],
  opts: StreamDebugOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const debug = opts.debug === true
  const reqId = opts.reqId ?? 'na'
  const startedAt = Date.now()
  const model = opts.model ?? 'gemini-2.5-flash-lite'
  const maxOutputTokens = Math.max(64, Math.min(4096, opts.maxOutputTokens ?? 512))
  const coalesceChars = Math.max(4, Math.min(64, opts.coalesceChars ?? 12))
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: mapGeminiToGoogleContents(messages),
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens,
    },
  }

  if (debug) {
    const inputChars = messages
      .flatMap(m => m.parts)
      .reduce((n, p) => n + ('text' in p && typeof p.text === 'string' ? p.text.length : 0), 0)
    const imageParts = messages
      .flatMap(m => m.parts)
      .filter(p => 'inlineData' in p && Boolean(p.inlineData?.data)).length
    console.log(
      `[gemini ${reqId}] start model=${model} max_tokens=${maxOutputTokens} coalesce=${coalesceChars} ` +
      `msg_count=${messages.length} input_chars=${inputChars} image_parts=${imageParts} system_chars=${systemPrompt.length}`
    )
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const encoder = new TextEncoder()
  if (debug) {
    console.log(
      `[gemini ${reqId}] upstream status=${upstream.status} ok=${upstream.ok} ` +
      `fetch_ms=${Date.now() - startedAt} ` +
      `req_header_id=${getHeader(upstream.headers, 'x-request-id') || getHeader(upstream.headers, 'request-id')} ` +
      `content_type=${getHeader(upstream.headers, 'content-type')}`
    )
  }

  if (!upstream.ok) {
    const err = await upstream.text()
    if (debug) console.error(`[gemini ${reqId}] upstream error body=${err.slice(0, 600)}`)
    return new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err })}\n\n`))
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: '' })}\n\n`))
        ctrl.close()
      },
    })
  }

  if (!upstream.body) {
    if (debug) console.error(`[gemini ${reqId}] upstream body is null`)
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
  let pendingText = ''
  let eventCount = 0
  let parseErrorCount = 0
  let emitCount = 0
  let firstTokenAt = 0
  const emitText = (ctrl: TransformStreamDefaultController<Uint8Array>, force = false) => {
    if (!pendingText) return
    const shouldFlushByPunc = /[\uFF0C\u3002\uFF01\uFF1F,.!?;\uFF1B:\uFF1A\n]$/.test(pendingText)
    if (force || pendingText.length >= coalesceChars || shouldFlushByPunc) {
      emitCount += 1
      if (debug && (emitCount <= 3 || force)) {
        console.log(`[gemini ${reqId}] emit #${emitCount} chars=${pendingText.length} force=${force}`)
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
            emitText(ctrl, true)
            ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`))
            if (debug) {
              console.log(
                `[gemini ${reqId}] done via [DONE] full_len=${fullText.length} events=${eventCount} ` +
                `emits=${emitCount} parse_errors=${parseErrorCount} total_ms=${Date.now() - startedAt}`
              )
            }
          }
          continue
        }

        try {
          eventCount += 1
          const parsed = JSON.parse(raw)
          const piece = extractGeminiChunkText(parsed)
          if (piece) {
            if (!firstTokenAt) {
              firstTokenAt = Date.now()
              if (debug) console.log(`[gemini ${reqId}] first_token_ms=${firstTokenAt - startedAt}`)
            }
            fullText += piece
            pendingText += piece
            emitText(ctrl)
          }
          const finishReason =
            (parsed as { candidates?: Array<{ finishReason?: string }> })?.candidates?.[0]?.finishReason ?? ''
          if (debug && (eventCount <= 3 || finishReason)) {
            console.log(
              `[gemini ${reqId}] event=${eventCount} piece_len=${piece.length} finish=${finishReason || 'none'}`
            )
          }
          if (finishReason && !doneSent) {
            doneSent = true
            emitText(ctrl, true)
            ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`))
            if (debug) {
              console.log(
                `[gemini ${reqId}] done via finish_reason=${finishReason} full_len=${fullText.length} ` +
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
        emitText(ctrl, true)
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`))
        if (debug) {
          console.log(
            `[gemini ${reqId}] done via flush full_len=${fullText.length} events=${eventCount} ` +
            `emits=${emitCount} parse_errors=${parseErrorCount} total_ms=${Date.now() - startedAt}`
          )
        }
      }
    },
  })

  return upstream.body.pipeThrough(transform)
}

