#!/usr/bin/env node

const http = require('node:http')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { Pool } = require('pg')

const HOST = process.env.HOST || '127.0.0.1'
const PORT = parseInt(process.env.PORT || '8789', 10)
const DATABASE_URL = process.env.DATABASE_URL || process.env.RAG_DATABASE_URL || ''
const RAG_API_KEY = process.env.RAG_API_KEY || ''
const ALLOW_MOCK = String(process.env.RAG_MOCK || '').toLowerCase() === 'true'
const AUTO_INIT_SCHEMA = String(process.env.RAG_AUTO_INIT_SCHEMA || 'true').toLowerCase() !== 'false'
const SEARCH_DEBUG = String(process.env.RAG_SEARCH_DEBUG || '').toLowerCase() === 'true'
const SCHEMA_PATH = path.resolve(__dirname, '..', 'schema-knowledgeos.sql')

if (!DATABASE_URL && !ALLOW_MOCK) {
  console.error('[rag-service] missing DATABASE_URL')
  process.exit(1)
}

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      max: parseInt(process.env.PGPOOL_MAX || '10', 10),
      connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECT_TIMEOUT_MS || '5000', 10),
      ssl: String(process.env.PGSSLMODE || '').toLowerCase() === 'disable' ? undefined : false,
    })
  : null

let schemaBootstrapReady = false
let schemaBootstrapError = null

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id, X-Bot-Id, X-Request-Id',
}

function sendJson(res, status, body) {
  res.writeHead(status, { ...cors, 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.from(chunk)
    total += buf.length
    if (total > 1024 * 1024) throw new Error('Request body too large')
    chunks.push(buf)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  return raw ? JSON.parse(raw) : {}
}

function clampTopK(value) {
  const n = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(n) || n <= 0) return 8
  return Math.min(n, 20)
}

const SEARCH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'before',
  'but',
  'by',
  'do',
  'does',
  'did',
  'for',
  'from',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'its',
  'me',
  'more',
  'of',
  'on',
  'or',
  'our',
  'please',
  'should',
  'than',
  'that',
  'the',
  'their',
  'them',
  'there',
  'these',
  'this',
  'those',
  'to',
  'too',
  'under',
  'us',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'would',
])

function normalizeSearchQuery(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchVariants(value) {
  const original = String(value || '').trim()
  const normalized = normalizeSearchQuery(original)
  const tokens = normalized
    .split(' ')
    .map(token => token.trim())
    .filter(token => token && (!SEARCH_STOPWORDS.has(token) || /\d/.test(token)))

  const variants = []
  const pushVariant = candidate => {
    const v = String(candidate || '').trim()
    if (v && !variants.includes(v)) variants.push(v)
  }

  pushVariant(original)
  pushVariant(normalized)
  pushVariant(tokens.join(' '))

  if (tokens.length > 1) {
    pushVariant(tokens.join(' OR '))
  }

  const numericTokens = tokens.filter(token => /\d/.test(token))
  if (numericTokens.length > 1) {
    pushVariant(numericTokens.join(' '))
    pushVariant(numericTokens.join(' OR '))
  }

  if (tokens.length > 2) {
    pushVariant(tokens.slice(0, 3).join(' '))
    pushVariant(tokens.slice(-3).join(' '))
  }

  return variants
}

async function searchWithQuery(client, req, queryText) {
  return Promise.all([
    searchChunks(client, { ...req, query: queryText }),
    searchQaPairs(client, { ...req, query: queryText }),
  ]).then(([docChunks, qaPairs]) => [...docChunks, ...qaPairs])
}

function chunkText(text, maxChars = 1200) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!clean) return []
  const paragraphs = clean.split(/\n{2,}/g).map(s => s.trim()).filter(Boolean)
  const chunks = []
  let buffer = ''

  const flush = () => {
    const piece = buffer.trim()
    if (piece) chunks.push(piece)
    buffer = ''
  }

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph
    if (candidate.length <= maxChars) {
      buffer = candidate
      continue
    }
    flush()
    if (paragraph.length <= maxChars) {
      buffer = paragraph
      continue
    }
    let rest = paragraph
    while (rest.length > maxChars) {
      chunks.push(rest.slice(0, maxChars))
      rest = rest.slice(maxChars)
    }
    buffer = rest
  }

  flush()
  return chunks
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : []
}

function toSlug(value, fallback) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
  return slug || fallback
}

async function bootstrapSchema() {
  if (!pool || !AUTO_INIT_SCHEMA) return

  const client = await pool.connect()
  try {
    const requiredTables = [
      'tenants',
      'users',
      'tenant_members',
      'bots',
      'data_sources',
      'documents',
      'document_versions',
      'document_chunks',
      'qa_pairs',
      'conversations',
      'messages',
      'message_citations',
      'conversation_summaries',
      'ingestion_jobs',
      'crawl_jobs',
      'reindex_jobs',
    ]
    const existing = await client.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      `,
      [requiredTables],
    )
    const existingSet = new Set(existing.rows.map(row => row.table_name))
    const missing = requiredTables.filter(table => !existingSet.has(table))
    if (!missing.length) {
      console.log('[rag-service] schema already initialized')
      return
    }

    console.log('[rag-service] bootstrapping schema; missing tables:', missing.join(', '))
    const schemaSql = await fs.readFile(SCHEMA_PATH, 'utf8')
    await client.query(schemaSql)
    console.log('[rag-service] schema bootstrap complete')
    schemaBootstrapReady = true
  } finally {
    client.release()
  }
}

async function seedDemoTenantAndBot(client) {
  await client.query(
    `INSERT INTO tenants (id, name, slug, plan, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'starter', 'active', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       slug = EXCLUDED.slug,
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       updated_at = NOW()`,
    ['tenant_demo', 'Demo Tenant', 'demo-tenant'],
  )

  await client.query(
    `INSERT INTO bots (id, tenant_id, name, persona, tone, welcome_msg, fallback_msg, language, settings_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       tenant_id = EXCLUDED.tenant_id,
       name = EXCLUDED.name,
       persona = EXCLUDED.persona,
       tone = EXCLUDED.tone,
       welcome_msg = EXCLUDED.welcome_msg,
       fallback_msg = EXCLUDED.fallback_msg,
       language = EXCLUDED.language,
       settings_json = EXCLUDED.settings_json,
       updated_at = NOW()`,
    [
      'bot_demo',
      'tenant_demo',
      'Demo Bot',
      'Professional enterprise assistant',
      'concise',
      'Hello, how can I help?',
      'Sorry, I could not find a relevant answer.',
      'zh-CN',
      JSON.stringify({ max_history_turns: 10, citation_display: true, retrieval_top_k: 8 }),
    ],
  )
}

async function ensureTenantAndBot(client, tenantId, botId) {
  const tenantSlug = toSlug(tenantId, 'tenant')
  const botName = botId || 'KnowledgeOS Bot'

  await client.query(
    `INSERT INTO tenants (id, name, slug, plan, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'starter', 'active', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       slug = EXCLUDED.slug,
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       updated_at = NOW()`,
    [tenantId, tenantId, tenantSlug],
  )

  if (botId) {
    await client.query(
      `INSERT INTO bots (id, tenant_id, name, persona, tone, welcome_msg, fallback_msg, language, settings_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         name = EXCLUDED.name,
         persona = EXCLUDED.persona,
         tone = EXCLUDED.tone,
         welcome_msg = EXCLUDED.welcome_msg,
         fallback_msg = EXCLUDED.fallback_msg,
         language = EXCLUDED.language,
         settings_json = EXCLUDED.settings_json,
         updated_at = NOW()`,
      [
        botId,
        tenantId,
        botName,
        'Professional enterprise assistant',
        'concise',
        'Hello, how can I help?',
        'Sorry, I could not find a relevant answer.',
        'zh-CN',
        JSON.stringify({ max_history_turns: 10, citation_display: true, retrieval_top_k: 8 }),
      ],
    )
  }
}

async function ensureSource(client, tenantId, botId, source) {
  const sourceId = String(source?.id || '').trim()
  if (!sourceId) return null

  const sourceType = String(source?.type || 'manual').trim()
  const sourceName = String(source?.name || sourceId).trim()
  const sourceConfig = source?.config_json && typeof source.config_json === 'object' ? source.config_json : {}
  const sourceStatus = String(source?.status || 'ready').trim()

  await client.query(
    `INSERT INTO data_sources (id, tenant_id, bot_id, type, name, config_json, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       tenant_id = EXCLUDED.tenant_id,
       bot_id = EXCLUDED.bot_id,
       type = EXCLUDED.type,
       name = EXCLUDED.name,
       config_json = EXCLUDED.config_json,
       status = EXCLUDED.status,
       updated_at = NOW()`,
    [sourceId, tenantId, botId || null, sourceType, sourceName, JSON.stringify(sourceConfig), sourceStatus],
  )

  return sourceId
}

function buildFilterClause(params, filters, alias) {
  const clauses = []
  if (filters && Array.isArray(filters.source_ids) && filters.source_ids.length) {
    params.push(filters.source_ids.map(String))
    clauses.push(`${alias}.source_id = ANY($${params.length})`)
  }
  if (filters && Array.isArray(filters.source_types) && filters.source_types.length) {
    params.push(filters.source_types.map(String))
    clauses.push(`${alias}.source_type = ANY($${params.length})`)
  }
  if (filters && Array.isArray(filters.document_ids) && filters.document_ids.length) {
    params.push(filters.document_ids.map(String))
    clauses.push(`${alias}.document_id = ANY($${params.length})`)
  }
  return clauses.length ? ` AND ${clauses.join(' AND ')}` : ''
}

async function health() {
  if (!pool) {
    return {
      ok: true,
      service: 'knowledgeos-rag',
      mock_mode: true,
      database: null,
      vector_extension: false,
      schema_bootstrap_ready: schemaBootstrapReady,
      schema_bootstrap_error: schemaBootstrapError,
    }
  }

  try {
    const client = await pool.connect()
    try {
    const vector = await client.query(`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed`)
    const version = await client.query(`SELECT version() AS version`)
    return {
      ok: true,
      service: 'knowledgeos-rag',
      mock_mode: false,
      database: true,
      vector_extension: Boolean(vector.rows[0]?.installed),
      postgres_version: version.rows[0]?.version || null,
      schema_bootstrap_ready: schemaBootstrapReady,
      schema_bootstrap_error: schemaBootstrapError,
    }
    } finally {
      client.release()
    }
  } catch (error) {
    return {
      ok: false,
      service: 'knowledgeos-rag',
      mock_mode: false,
      database: false,
      vector_extension: false,
      error: error instanceof Error ? error.message : String(error),
      schema_bootstrap_ready: schemaBootstrapReady,
      schema_bootstrap_error: schemaBootstrapError,
    }
  }
}

async function searchChunks(client, req) {
  const params = []
  const query = String(req.query || '').trim()
  const tenantId = String(req.tenant_id || '').trim()
  const botId = req.bot_id ? String(req.bot_id).trim() : null
  const topK = clampTopK(req.top_k)
  if (!tenantId || !query) return []

  params.push(tenantId)
  params.push(botId)
  params.push(query)
  const filterClause = buildFilterClause(params, req.filters, 'dc')

  const sql = `
    SELECT
      'chunk' AS kind,
      dc.id,
      dc.doc_id AS document_id,
      dc.title,
      dc.section,
      dc.content,
      dc.source_url,
      dc.page_num,
      dc.source_type,
      d.source_id,
      s.name AS source_label,
      COALESCE(
        ts_rank_cd(
          to_tsvector('simple', COALESCE(dc.title, '') || ' ' || COALESCE(dc.section, '') || ' ' || COALESCE(dc.content, '')),
          websearch_to_tsquery('simple', $3)
        ),
        0
      )
      + CASE WHEN dc.content ILIKE '%' || $3 || '%' THEN 0.75 ELSE 0 END
      + CASE WHEN dc.title ILIKE '%' || $3 || '%' THEN 0.25 ELSE 0 END AS score
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.doc_id
    LEFT JOIN data_sources s ON s.id = d.source_id
    WHERE dc.tenant_id = $1
      AND ($2::text IS NULL OR s.bot_id = $2 OR d.source_id IS NULL)
      AND (
        to_tsvector('simple', COALESCE(dc.title, '') || ' ' || COALESCE(dc.section, '') || ' ' || COALESCE(dc.content, '')) @@ websearch_to_tsquery('simple', $3)
        OR dc.content ILIKE '%' || $3 || '%'
        OR dc.title ILIKE '%' || $3 || '%'
        OR dc.section ILIKE '%' || $3 || '%'
      )
      ${filterClause}
    ORDER BY score DESC, dc.created_at DESC
    LIMIT ${topK}
  `

  const { rows } = await client.query(sql, params)
  return rows.map(row => ({
    id: row.id,
    chunk_id: row.id,
    document_id: row.document_id,
    title: row.title,
    section: row.section,
    content: row.content,
    source_url: row.source_url,
    page_num: row.page_num,
    source_label: row.source_label,
    source_type: row.source_type,
    score: Number(row.score) || 0,
  }))
}

async function searchQaPairs(client, req) {
  const params = []
  const query = String(req.query || '').trim()
  const tenantId = String(req.tenant_id || '').trim()
  const botId = req.bot_id ? String(req.bot_id).trim() : null
  const topK = clampTopK(req.top_k)
  if (!tenantId || !query) return []

  params.push(tenantId)
  params.push(botId)
  params.push(query)
  const filterClause = buildFilterClause(params, {
    source_ids: req.filters && Array.isArray(req.filters.source_ids) ? req.filters.source_ids : undefined,
    source_types: req.filters && Array.isArray(req.filters.source_types) ? req.filters.source_types : undefined,
  }, 'q')

  const sql = `
    SELECT
      'qa' AS kind,
      q.id,
      q.id AS qa_pair_id,
      NULL::text AS document_id,
      q.question AS title,
      NULL::text AS section,
      q.answer AS content,
      NULL::text AS source_url,
      NULL::integer AS page_num,
      'qa'::text AS source_type,
      NULL::text AS source_id,
      'Q&A'::text AS source_label,
      COALESCE(
        ts_rank_cd(
          to_tsvector('simple', COALESCE(q.question, '') || ' ' || COALESCE(q.answer, '')),
          websearch_to_tsquery('simple', $3)
        ),
        0
      )
      + CASE WHEN q.question ILIKE '%' || $3 || '%' THEN 0.9 ELSE 0 END
      + CASE WHEN q.answer ILIKE '%' || $3 || '%' THEN 0.6 ELSE 0 END
      + LEAST(q.priority::numeric / 100.0, 1.0) AS score
    FROM qa_pairs q
    WHERE q.tenant_id = $1
      AND ($2::text IS NULL OR q.bot_id = $2 OR q.bot_id IS NULL)
      AND (
        to_tsvector('simple', COALESCE(q.question, '') || ' ' || COALESCE(q.answer, '')) @@ websearch_to_tsquery('simple', $3)
        OR q.question ILIKE '%' || $3 || '%'
        OR q.answer ILIKE '%' || $3 || '%'
      )
      ${filterClause}
    ORDER BY score DESC, q.created_at DESC
    LIMIT ${topK}
  `

  const { rows } = await client.query(sql, params)
  return rows.map(row => ({
    id: row.id,
    qa_pair_id: row.qa_pair_id || row.id,
    document_id: row.document_id,
    title: row.title,
    section: row.section,
    content: row.content,
    source_url: row.source_url,
    page_num: row.page_num,
    source_label: row.source_label,
    source_type: row.source_type,
    score: Number(row.score) || 0,
  }))
}

async function search(req) {
  if (!pool) {
    return {
      request_id: req.request_id ?? null,
      latency_ms: 1,
      chunks: [],
      warnings: ['DATABASE_URL is not configured.'],
    }
  }

  const client = await pool.connect()
  const started = Date.now()
  try {
    const topK = clampTopK(req.top_k)
    const merged = []
    const seen = new Set()
    const variants = buildSearchVariants(req.query)
    const debugTrace = []

    for (const variant of variants) {
      const hits = await searchWithQuery(client, req, variant)
      debugTrace.push({ variant, hits: hits.length })
      for (const item of hits) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        merged.push(item)
        if (merged.length >= topK) break
      }
      if (merged.length >= topK) break
    }

    merged.sort((a, b) => (b.score || 0) - (a.score || 0))
    const trimmed = merged.slice(0, topK)
    if (SEARCH_DEBUG || !trimmed.length) {
      console.log('[rag-service] search trace', JSON.stringify({
        tenant_id: req.tenant_id || null,
        bot_id: req.bot_id || null,
        query: req.query || '',
        variants,
        trace: debugTrace,
        result_count: trimmed.length,
      }))
    }
    return {
      request_id: req.request_id ?? null,
      latency_ms: Date.now() - started,
      chunks: trimmed,
      warnings: trimmed.length ? [] : ['No matches found.'],
    }
  } finally {
    client.release()
  }
}

async function ingestDocument(req) {
  if (!pool) return { ok: false, warning: 'DATABASE_URL is not configured.' }
  const payload = req || {}
  const tenantId = String(payload.tenant_id || '').trim()
  const doc = payload.document || {}
  const source = payload.source || {}
  const sourceId = payload.source_id ? String(payload.source_id) : String(source.id || '').trim() || null
  const botId = payload.bot_id ? String(payload.bot_id) : null
  const text = String(doc.text || '').trim()
  if (!tenantId) return { ok: false, error: 'tenant_id is required' }
  if (!doc.title && !text) return { ok: false, error: 'document.title or document.text is required' }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await ensureTenantAndBot(client, tenantId, botId)
    const ensuredSourceId = await ensureSource(client, tenantId, botId, {
      id: sourceId,
      type: source.type || 'manual',
      name: source.name || doc.title || 'KnowledgeOS Source',
      config_json: source.config_json || {},
      status: source.status || 'ready',
    })
    const docId = String(doc.id || crypto.randomUUID())
    const existing = await client.query('SELECT version FROM documents WHERE id = $1 LIMIT 1', [docId])
    const nextVersion = existing.rows[0] ? Number(existing.rows[0].version || 1) + 1 : 1
    const status = text ? 'ready' : 'uploaded'
    await client.query(
      `
      INSERT INTO documents (id, tenant_id, source_id, title, file_name, r2_key, status, error_msg, version, created_at, updated_at, deleted_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, NOW(), NOW(), NULL)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        source_id = EXCLUDED.source_id,
        title = EXCLUDED.title,
        file_name = EXCLUDED.file_name,
        r2_key = EXCLUDED.r2_key,
        status = EXCLUDED.status,
        error_msg = NULL,
        version = EXCLUDED.version,
        updated_at = NOW(),
        deleted_at = NULL
      `,
      [
        docId,
        tenantId,
        ensuredSourceId,
        String(doc.title || 'Untitled document'),
        doc.file_name || null,
      doc.r2_key || null,
        status,
        nextVersion,
      ],
    )

    await client.query('DELETE FROM document_chunks WHERE doc_id = $1', [docId])

    const chunks = chunkText(text)
    for (let index = 0; index < chunks.length; index += 1) {
      await client.query(
        `
        INSERT INTO document_chunks (id, doc_id, tenant_id, content, title, section, source_url, page_num, token_count, source_type, embedding, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, NOW(), NOW())
        `,
        [
          crypto.randomUUID(),
          docId,
          tenantId,
          chunks[index],
          String(doc.title || 'Untitled document'),
          `chunk ${index + 1}`,
          doc.source_url || null,
          null,
          chunks[index].length,
          'document',
        ],
      )
    }

    await client.query(
      'INSERT INTO document_versions (id, doc_id, version, r2_key, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [crypto.randomUUID(), docId, nextVersion, doc.file_name || null],
    )

    if (botId) {
      await client.query('UPDATE documents SET source_id = COALESCE(source_id, $1) WHERE id = $2', [ensuredSourceId, docId])
    }

    await client.query('COMMIT')
    return { ok: true, document_id: docId, version: nextVersion, chunks: chunks.length }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function ingestQa(req) {
  if (!pool) return { ok: false, warning: 'DATABASE_URL is not configured.' }
  const payload = req || {}
  const tenantId = String(payload.tenant_id || '').trim()
  const botId = payload.bot_id ? String(payload.bot_id) : null
  const source = payload.source || {}
  const qaPairs = Array.isArray(payload.qa_pairs) ? payload.qa_pairs : []
  if (!tenantId) return { ok: false, error: 'tenant_id is required' }
  if (!qaPairs.length) return { ok: false, error: 'qa_pairs is required' }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await ensureTenantAndBot(client, tenantId, botId)
    await ensureSource(client, tenantId, botId, {
      id: String(payload.source_id || source.id || '').trim() || null,
      type: source.type || 'qa',
      name: source.name || 'Q&A',
      config_json: source.config_json || {},
      status: source.status || 'ready',
    })
    const inserted = []
    for (const raw of qaPairs) {
      const item = raw || {}
      const id = String(item.id || crypto.randomUUID())
      const tags = normalizeArray(item.tags)
      const question = String(item.question || '').trim()
      const answer = String(item.answer || '').trim()
      if (!question || !answer) continue
      await client.query(
        `
        INSERT INTO qa_pairs (id, tenant_id, bot_id, question, answer, tags, priority, embedding, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          bot_id = EXCLUDED.bot_id,
          question = EXCLUDED.question,
          answer = EXCLUDED.answer,
          tags = EXCLUDED.tags,
          priority = EXCLUDED.priority,
          updated_at = NOW()
        `,
        [id, tenantId, botId, question, answer, tags, Number(item.priority || 0)],
      )
      inserted.push(id)
    }
    await client.query('COMMIT')
    return { ok: true, qa_pair_ids: inserted }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  if (pool && AUTO_INIT_SCHEMA) {
    bootstrapSchema()
      .then(async () => {
        const client = await pool.connect()
        try {
          await seedDemoTenantAndBot(client)
          schemaBootstrapReady = true
          console.log('[rag-service] demo tenant and bot seeded')
        } finally {
          client.release()
        }
      })
      .catch(error => {
        schemaBootstrapError = error instanceof Error ? error.message : String(error)
        console.error('[rag-service] schema bootstrap failed', error)
      })
  }

  const server = http.createServer(async (req, res) => {
    const started = Date.now()
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
      const method = String(req.method || 'GET').toUpperCase()
      const auth = String(req.headers.authorization || '')

      if (method === 'OPTIONS') {
        res.writeHead(204, cors)
        res.end()
        return
      }

      if (RAG_API_KEY && auth !== `Bearer ${RAG_API_KEY}` && url.pathname !== '/health') {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }

      if (method === 'GET' && url.pathname === '/health') {
        const data = await health()
        sendJson(res, 200, data)
        return
      }

      if (method === 'POST' && url.pathname === '/search') {
        const body = await readJson(req)
        const data = await search(body)
        sendJson(res, 200, { ...data, request_ms: Date.now() - started })
        return
      }

      if (method === 'POST' && url.pathname === '/ingest/document') {
        const body = await readJson(req)
        const data = await ingestDocument(body)
        sendJson(res, data.ok ? 200 : 400, data)
        return
      }

      if (method === 'POST' && url.pathname === '/ingest/qa') {
        const body = await readJson(req)
        const data = await ingestQa(body)
        sendJson(res, data.ok ? 200 : 400, data)
        return
      }

      sendJson(res, 404, { error: 'Not found' })
    } catch (error) {
      console.error('[rag-service] error', error)
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Internal server error' })
    }
  })

  server.listen(PORT, HOST, () => {
    console.log(`[rag-service] listening on http://${HOST}:${PORT}`)
  })
}

main().catch(error => {
  console.error('[rag-service] fatal startup error', error)
  process.exit(1)
})
