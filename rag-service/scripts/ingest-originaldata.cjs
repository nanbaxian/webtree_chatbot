#!/usr/bin/env node

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const ROOT = path.resolve(__dirname, '..', '..')
const MANIFEST_PATH = path.resolve(ROOT, 'originaldata', 'processed', 'ingestion_manifest.json')

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.RAG_INGEST_URL || process.env.RAG_API_URL || 'http://127.0.0.1:8789',
    tenantId: process.env.RAG_INGEST_TENANT_ID || 'tenant_demo',
    botId: process.env.RAG_INGEST_BOT_ID || 'bot_demo',
    apiKey: process.env.RAG_API_KEY || '',
    dryRun: false,
    includeExcluded: false,
    withSourceMetadata: false,
    fallbackWithoutSourceMetadata: true,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--dry-run') {
      args.dryRun = true
    } else if (token === '--include-excluded') {
      args.includeExcluded = true
    } else if (token === '--with-source-metadata') {
      args.withSourceMetadata = true
    } else if (token === '--no-fallback') {
      args.fallbackWithoutSourceMetadata = false
    } else if (token === '--base-url') {
      args.baseUrl = argv[++i]
    } else if (token === '--tenant-id') {
      args.tenantId = argv[++i]
    } else if (token === '--bot-id') {
      args.botId = argv[++i]
    } else if (token === '--api-key') {
      args.apiKey = argv[++i]
    } else if (token === '--help' || token === '-h') {
      args.help = true
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }

  return args
}

function stableId(prefix, input) {
  const hash = crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 16)
  return `${prefix}-${hash}`
}

function sourceTypeToApiType(sourceType) {
  switch (sourceType) {
    case 'site_archive':
      return 'website'
    case 'academic':
      return 'manual'
    case 'staff':
      return 'manual'
    default:
      return 'manual'
  }
}

function sourceTypeToName(sourceType) {
  switch (sourceType) {
    case 'site_archive':
      return 'Webtree Academy Website Archive'
    case 'academic':
      return 'Master Timetable 2025-2026'
    case 'staff':
      return 'Teachers Directory'
    case 'ossd_core':
      return 'OSSD Core Guide'
    case 'ossd_outlines':
      return 'OSSD Course Outlines'
    case 'university_programs':
      return 'Ontario University Program Seed'
    case 'competitions_exams':
      return 'Canada and US Competitions and Exams Guide'
    default:
      return sourceType
  }
}

function pickRawPath(rawPath) {
  if (Array.isArray(rawPath)) return rawPath[0] || ''
  return rawPath || ''
}

async function loadManifest() {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8')
  return JSON.parse(raw)
}

async function loadProcessedText(relativePath) {
  const filePath = path.resolve(ROOT, relativePath)
  return fs.readFile(filePath, 'utf8')
}

async function postJson(url, body, apiKey) {
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  return { ok: response.ok, status: response.status, data }
}

function printHelp() {
  console.log(`Usage:
  node scripts/ingest-originaldata.cjs [options]

Options:
  --dry-run               Print planned payloads without writing to RAG
  --include-excluded      Include screenshot provenance assets
  --with-source-metadata  Send data_sources metadata when the RAG server supports it
  --no-fallback           Disable automatic retry without source metadata
  --base-url <url>        RAG service base URL (default: ${process.env.RAG_INGEST_URL || process.env.RAG_API_URL || 'http://127.0.0.1:8789'})
  --tenant-id <id>        Tenant ID (default: tenant_demo)
  --bot-id <id>           Bot ID (default: bot_demo)
  --api-key <key>         Override bearer token
`)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }

  const manifest = await loadManifest()
  const sources = (manifest.sources || []).filter(source => args.includeExcluded || source.status !== 'excluded')
  if (!sources.length) {
    console.log('[ingest-originaldata] no sources to ingest')
    return
  }

  console.log(`[ingest-originaldata] corpus=${manifest.corpus_name || 'unknown'} sources=${sources.length} dryRun=${args.dryRun}`)

  const results = []
  for (const source of sources) {
    const processedPath = source.processed_path
    const rawPath = pickRawPath(source.raw_path)
    const text = await loadProcessedText(processedPath)
    const sourceId = stableId('src', `${source.source_type}|${processedPath}`)
    const docId = stableId('doc', processedPath)
    const fileName = path.basename(processedPath)
    const payload = {
      tenant_id: args.tenantId,
      bot_id: args.botId,
      document: {
        id: docId,
        title: sourceTypeToName(source.source_type),
        file_name: fileName,
        text,
        source_url: null,
        r2_key: null,
      },
    }

    if (args.withSourceMetadata) {
      payload.source_id = sourceId
      payload.source = {
        id: sourceId,
        type: sourceTypeToApiType(source.source_type),
        name: sourceTypeToName(source.source_type),
        status: 'ready',
        config_json: {
          corpus_name: manifest.corpus_name || null,
          source_type: source.source_type,
          raw_path: source.raw_path || null,
          processed_path: processedPath,
          raw_source: rawPath || null,
        },
      }
    }

    if (args.dryRun) {
      console.log(`[dry-run] ${source.source_type}: ${processedPath} -> ${text.length} chars`)
      results.push({ source_type: source.source_type, processed_path: processedPath, chars: text.length })
      continue
    }

    const ingestUrl = `${args.baseUrl.replace(/\/$/, '')}/ingest/document`
    const sendAttempt = async attemptPayload => postJson(ingestUrl, attemptPayload, args.apiKey)
    let response = await sendAttempt(payload)

    if (!response.ok && args.withSourceMetadata && args.fallbackWithoutSourceMetadata) {
      const fallbackPayload = {
        tenant_id: payload.tenant_id,
        bot_id: payload.bot_id,
        document: payload.document,
      }
      console.log(`[fallback] ${source.source_type}: retrying without source metadata`)
      response = await sendAttempt(fallbackPayload)
    }

    if (!response.ok) {
      throw new Error(`Failed to ingest ${processedPath}: ${response.status} ${JSON.stringify(response.data)}`)
    }
    console.log(`[ingested] ${source.source_type}: ${processedPath} -> document ${response.data.document_id || docId}`)
    results.push(response.data)
  }

  console.log(JSON.stringify({ ok: true, sources: results.length, dryRun: args.dryRun }, null, 2))
}

main().catch(error => {
  console.error('[ingest-originaldata] failed', error)
  process.exit(1)
})
