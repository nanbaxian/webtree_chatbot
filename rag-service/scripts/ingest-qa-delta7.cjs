#!/usr/bin/env node

const fs = require('node:fs/promises')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const QA_DELTA_PATH = path.resolve(ROOT, 'originaldata', 'processed', 'qa_seed_delta7.json')

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.RAG_INGEST_URL || process.env.RAG_API_URL || 'http://127.0.0.1:8789',
    tenantId: process.env.RAG_INGEST_TENANT_ID || 'tenant_demo',
    botId: process.env.RAG_INGEST_BOT_ID || 'bot_demo',
    apiKey: process.env.RAG_API_KEY || '',
    dryRun: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--dry-run') {
      args.dryRun = true
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

async function loadSeed() {
  const raw = await fs.readFile(QA_DELTA_PATH, 'utf8')
  return JSON.parse(raw)
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
  node scripts/ingest-qa-delta7.cjs [options]

Options:
  --dry-run          Print planned payload without writing to RAG
  --base-url <url>   RAG service base URL (default: ${process.env.RAG_INGEST_URL || process.env.RAG_API_URL || 'http://127.0.0.1:8789'})
  --tenant-id <id>   Tenant ID (default: tenant_demo)
  --bot-id <id>      Bot ID (default: bot_demo)
  --api-key <key>    Override bearer token
`)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }

  const seed = await loadSeed()
  const qaPairs = Array.isArray(seed.qa_pairs) ? seed.qa_pairs : []
  if (!qaPairs.length) {
    console.log('[ingest-qa-delta7] no qa pairs found')
    return
  }

  const payload = {
    tenant_id: args.tenantId || seed.tenant_id || 'tenant_demo',
    bot_id: args.botId || seed.bot_id || 'bot_demo',
    qa_pairs: qaPairs,
  }

  if (args.dryRun) {
    console.log(JSON.stringify({ ok: true, qa_pairs: qaPairs.length, dryRun: true }, null, 2))
    return
  }

  const response = await postJson(`${args.baseUrl.replace(/\/$/, '')}/ingest/qa`, payload, args.apiKey)
  if (!response.ok) {
    throw new Error(`Failed to ingest QA delta7: ${response.status} ${JSON.stringify(response.data)}`)
  }

  console.log(JSON.stringify({ ok: true, qa_pair_ids: response.data.qa_pair_ids || [] }, null, 2))
}

main().catch(error => {
  console.error('[ingest-qa-delta7] failed', error)
  process.exit(1)
})
