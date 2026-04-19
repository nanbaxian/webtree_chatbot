export type RagSearchFilter = {
  source_ids?: string[]
  source_types?: string[]
  document_ids?: string[]
}

export type RagSearchRequest = {
  tenant_id: string
  bot_id: string
  query: string
  top_k: number
  conversation_id?: string | null
  request_id?: string | null
  locale?: 'zh' | 'en'
  filters?: RagSearchFilter
}

export type RagChunk = {
  id?: string
  chunk_id?: string
  qa_pair_id?: string
  document_id?: string
  title?: string
  section?: string
  content?: string
  source_url?: string
  source_label?: string
  source_type?: string
  page_num?: number
  score?: number
  metadata?: Record<string, unknown>
}

export type RagSearchResponse = {
  request_id?: string | null
  latency_ms?: number
  chunks: RagChunk[]
  warnings?: string[]
}

export type RagIngestDocumentRequest = {
  tenant_id: string
  source_id?: string | null
  bot_id?: string | null
  document: {
    id?: string
    title: string
    file_name?: string | null
    r2_key?: string | null
    source_url?: string | null
    mime_type?: string | null
    text?: string
    metadata?: Record<string, unknown>
  }
}

export type RagIngestQaRequest = {
  tenant_id: string
  bot_id?: string | null
  qa_pairs: Array<{
    id?: string
    question: string
    answer: string
    tags?: string[]
    priority?: number
    metadata?: Record<string, unknown>
  }>
}

function asString(value: unknown, fallback?: string): string | undefined {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback?: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function buildRagSearchRequest(input: {
  tenantId: string
  botId: string
  query: string
  topK: number
  conversationId?: string | null
  requestId?: string | null
  locale?: 'zh' | 'en'
  filters?: RagSearchFilter
}): RagSearchRequest {
  return {
    tenant_id: input.tenantId,
    bot_id: input.botId,
    query: input.query,
    top_k: input.topK,
    conversation_id: input.conversationId ?? null,
    request_id: input.requestId ?? null,
    locale: input.locale,
    filters: input.filters,
  }
}

export function normalizeRagSearchResponse(payload: unknown): RagSearchResponse {
  if (!payload || typeof payload !== 'object') {
    return { chunks: [] }
  }
  const record = payload as Record<string, unknown>
  const sourceChunks = record.chunks ?? record.results ?? record.items ?? []
  const chunks = asArray<Record<string, unknown>>(sourceChunks).map(item => ({
    id: asString(item.id),
    chunk_id: asString(item.chunk_id),
    qa_pair_id: asString(item.qa_pair_id),
    document_id: asString(item.document_id),
    title: asString(item.title),
    section: asString(item.section),
    content: asString(item.content),
    source_url: asString(item.source_url),
    source_label: asString(item.source_label),
    source_type: asString(item.source_type),
    page_num: asNumber(item.page_num),
    score: asNumber(item.score),
    metadata: typeof item.metadata === 'object' && item.metadata !== null
      ? (item.metadata as Record<string, unknown>)
      : undefined,
  }))

  return {
    request_id: typeof record.request_id === 'string' ? record.request_id : null,
    latency_ms: asNumber(record.latency_ms, undefined),
    chunks,
    warnings: asArray<string>(record.warnings),
  }
}

export function formatRagPromptBlock(chunks: RagChunk[], topK: number): string {
  if (!chunks.length) return 'No relevant chunks were returned by the external RAG service.'

  return chunks
    .slice(0, topK)
    .map((chunk, idx) => {
      const label = chunk.source_label || chunk.title || `Source ${idx + 1}`
      const location = [chunk.section, chunk.page_num ? `page ${chunk.page_num}` : null].filter(Boolean).join(' / ')
      return [
        `- ${label}${location ? ` (${location})` : ''}`,
        chunk.source_type ? `  Type: ${chunk.source_type}` : '',
        chunk.source_url ? `  URL: ${chunk.source_url}` : '',
        chunk.content ? `  Excerpt: ${chunk.content.slice(0, 500)}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}
