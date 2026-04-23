#!/usr/bin/env node

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const ROOT = path.resolve(__dirname, '..', '..')
const PROCESSED_DIR = path.resolve(ROOT, 'originaldata', 'processed')
const OUTPUT_PATH = path.resolve(PROCESSED_DIR, 'qa_seed_1000.json')
const TARGET_COUNT = 1000

function stableId(prefix, input) {
  const hash = crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 16)
  return `${prefix}-${hash}`
}

function hasCjk(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''))
}

function normalizeQuestion(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTerminalPunctuation(text) {
  return String(text || '')
    .replace(/[?？。.!！；;:：]+$/g, '')
    .trim()
}

function uniquePush(list, seen, item) {
  const key = normalizeQuestion(item.question)
  if (!key || seen.has(key)) return false
  seen.add(key)
  list.push(item)
  return true
}

function buildVariants(question, tags = []) {
  const q = String(question || '').trim()
  const core = stripTerminalPunctuation(q)
  if (!q) return []

  const zh = hasCjk(q)
  const topicHint = Array.isArray(tags) ? tags.join(' ') : ''
  const variants = zh
    ? [
        `请问，${core}？`,
        `我想了解一下${core}。`,
        `关于${core}，可以说明一下吗？`,
        `能不能帮我回答一下${core}？`,
        `${core}，请详细说一下。`,
        `作为家长，我想知道${core}。`,
        `作为学生，我想知道${core}。`,
        `如果是国际学生，${core}，应该怎么理解？`,
      ]
    : [
        `Could you tell me ${core}?`,
        `I would like to know ${core}.`,
        `Can you explain ${core}?`,
        `Please answer: ${core}`,
        `For a parent, ${core}`,
        `For a student, ${core}`,
        `For an international student, ${core}`,
        `I need help with ${core}`,
      ]

  if (/\b(ossd|university|admission|admissions|tuition|fees|homestay|residence|schedule|course|grading|program)\b/i.test(topicHint + ' ' + q)) {
    variants.unshift(
      zh ? `家长问：${core}。` : `Parent question: ${core}`,
      zh ? `学生问：${core}。` : `Student question: ${core}`,
    )
  }

  return variants
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function loadSourcePairs() {
  const files = (await fs.readdir(PROCESSED_DIR))
    .filter(name => /^qa_seed.*\.json$/i.test(name))
    .filter(name => name !== 'qa_seed_1000.json')
    .sort((a, b) => a.localeCompare(b))

  const pairs = []
  for (const file of files) {
    const fullPath = path.join(PROCESSED_DIR, file)
    const payload = await loadJson(fullPath)
    const qaPairs = Array.isArray(payload.qa_pairs) ? payload.qa_pairs : []
    for (const qa of qaPairs) {
      const question = String(qa.question || '').trim()
      const answer = String(qa.answer || '').trim()
      if (!question || !answer) continue
      pairs.push({
        source_file: file,
        question,
        answer,
        tags: Array.isArray(qa.tags) ? qa.tags.map(String) : [],
        priority: Number.isFinite(Number(qa.priority)) ? Number(qa.priority) : 0,
      })
    }
  }
  return pairs
}

async function main() {
  const sourcePairs = await loadSourcePairs()
  if (!sourcePairs.length) {
    console.log('[generate-qa-bank] no source pairs found')
    return
  }

  const output = []
  const seen = new Set()

  for (const source of sourcePairs) {
    const baseId = stableId('qa', `${source.source_file}|${source.question}`)
    uniquePush(output, seen, {
      id: baseId,
      question: source.question,
      answer: source.answer,
      tags: source.tags,
      priority: source.priority,
      metadata: {
        source_file: source.source_file,
        variant_of: source.question,
        variant_type: 'original',
      },
    })

    const variants = buildVariants(source.question, source.tags)
    for (let index = 0; index < variants.length && output.length < TARGET_COUNT; index += 1) {
      const question = variants[index]
      const variantId = stableId('qa', `${source.source_file}|${source.question}|${index}|${question}`)
      uniquePush(output, seen, {
        id: variantId,
        question,
        answer: source.answer,
        tags: [...source.tags, 'variant'],
        priority: Math.max(1, source.priority - 2),
        metadata: {
          source_file: source.source_file,
          variant_of: source.question,
          variant_type: index < 2 ? 'role' : 'paraphrase',
        },
      })
    }

    if (output.length >= TARGET_COUNT) break
  }

  if (output.length < TARGET_COUNT) {
    console.log(`[generate-qa-bank] only generated ${output.length} items; target is ${TARGET_COUNT}`)
  }

  const payload = {
    name: 'webtree_chatbot_qa_bank_1000',
    tenant_id: 'tenant_demo',
    bot_id: 'bot_demo',
    qa_pairs: output.slice(0, TARGET_COUNT),
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ok: true, output: OUTPUT_PATH, qa_pairs: payload.qa_pairs.length }, null, 2))
}

main().catch(error => {
  console.error('[generate-qa-bank] failed', error)
  process.exit(1)
})
