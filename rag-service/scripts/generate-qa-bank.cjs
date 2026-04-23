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
    .replace(/[?.!;:]+$/g, '')
    .trim()
}

function lowerFirst(text) {
  const value = String(text || '')
  if (!value) return value
  return value.charAt(0).toLowerCase() + value.slice(1)
}

function normalizeCourseCodeCasing(text) {
  return String(text || '').replace(/\b([a-z]{3}\d[ucmof])\b/gi, match => match.toUpperCase())
}

function extractCourseCode(text) {
  const match = String(text || '').match(/\b([a-z]{3}\d[ucmof])\b/i)
  return match ? match[1].toUpperCase() : null
}

function hashBucket(text, size) {
  const value = String(text || '')
  let acc = 0
  for (let i = 0; i < value.length; i += 1) {
    acc = (acc * 31 + value.charCodeAt(i)) >>> 0
  }
  return size > 0 ? acc % size : 0
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
  const coreLower = normalizeCourseCodeCasing(lowerFirst(core))
  const courseCode = extractCourseCode(core)
  let topicCore = lowerFirst(
    core
      .replace(/[?.!;:]+$/g, '')
      .replace(/^(could you|can you|would you|please|i would like to|i want to|i am wondering about|i need help with)\s+/i, '')
      .replace(/^(what is|what are|what do|what does|where is|where are|when is|when are|who is|who are|how many|how much|how long|how far|how old|why is|why are|do|does|did|can|could|should|would|will|is|are|am|was|were)\s+/i, '')
      .replace(/\s+(mean|means|meaning|cover|covers|covered|include|includes|require|requires|look like|looks like)\s*$/i, '')
      .trim(),
  )
  topicCore = normalizeCourseCodeCasing(topicCore)
  const normalizedTopic = topicCore.toLowerCase()
  if (/^credits do i need for the ossd$/.test(normalizedTopic)) topicCore = 'the number of credits required for the OSSD'
  else if (/^compulsory credits are part of the ossd$/.test(normalizedTopic)) topicCore = 'the compulsory credits that are part of the OSSD'
  else if (/^ossd graduation requirements$/.test(normalizedTopic)) topicCore = 'the OSSD graduation requirements'
  else if (/^ossd literacy requirement$/.test(normalizedTopic)) topicCore = 'the OSSD literacy requirement'
  else if (/^community involvement hours are required for the ossd$/.test(normalizedTopic)) topicCore = 'the community involvement hours required for the OSSD'
  else if (/^online learning credits are required for the ossd$/.test(normalizedTopic)) topicCore = 'the online learning credits required for the OSSD'
  else if (/^graduates go to schools like u of t, waterloo, and york$/.test(normalizedTopic)) topicCore = 'graduate destinations at schools like U of T, Waterloo, and York'
  else if (/^ontario course codes like [a-z0-9]+$/.test(normalizedTopic)) topicCore = topicCore.replace(/^ontario course codes like\s+/i, 'Ontario course codes like ')
  else if (/^[a-z]{3}\d[ucmof]$/.test(normalizedTopic)) topicCore = topicCore.toUpperCase()
  if (courseCode) topicCore = courseCode
  const isCourseCodeQuery = /\b(course code|course codes|what does|what do|mean|means|cover|covers|covered|stand for)\b/i.test(q)
  const courseStyles = [
    topic => `What does ${topic} mean?`,
    topic => `What does ${topic} cover?`,
    topic => `Can you explain ${topic}?`,
    topic => `How should I read ${topic}?`,
    topic => `Can you break down ${topic}?`,
    topic => `How would you describe ${topic} to a parent?`,
    topic => `How would you describe ${topic} to a student?`,
    topic => `How should an international student understand ${topic}?`,
    topic => `What should I know about ${topic}?`,
    topic => `How is ${topic} usually taught?`,
    topic => `What are the key parts of ${topic}?`,
    topic => `How do I get started with ${topic}?`,
  ]

  const generalStyles = [
    topic => `Could you tell me about ${topic}?`,
    topic => `I would like to know more about ${topic}.`,
    topic => `Can you explain ${topic}?`,
    topic => `Please give me the details on ${topic}.`,
    topic => `How does ${topic} work?`,
    topic => `What should I know about ${topic}?`,
    topic => `What do parents usually ask about ${topic}?`,
    topic => `What do students usually want to know about ${topic}?`,
    topic => `How should an international student think about ${topic}?`,
    topic => `Could you walk me through ${topic}?`,
      topic => `How does ${topic} work in practice?`,
    topic => `Is there anything important I should know about ${topic}?`,
  ]

  const zhVariants = [
    `Could you tell me about ${core}?`,
    `I would like to understand ${core}.`,
    `Can you explain ${core} to me?`,
    `Please give me the details on ${core}.`,
    `As a parent, I want to know ${core}.`,
    `As a student, I want to know ${core}.`,
    `If I am an international student, how should I understand ${core}?`,
    `What should I know about ${core}?`,
  ]
  const englishPool = isCourseCodeQuery ? courseStyles : generalStyles
  const variants = zh ? zhVariants : []
  if (!zh) {
    const seed = hashBucket(topicCore || core, englishPool.length)
    for (let offset = 0; offset < Math.min(8, englishPool.length); offset += 1) {
      const style = englishPool[(seed + offset) % englishPool.length]
      const sentence = style(topicCore)
      if (sentence) variants.push(sentence)
    }
  }

  if (/\b(ossd|university|admission|admissions|tuition|fees|homestay|residence|schedule|course|grading|program)\b/i.test(topicHint + ' ' + q)) {
    variants.unshift(
      zh ? `我是家长，想了解${core}。` : `As a parent, could you tell me about ${topicCore}?`,
      zh ? `我是学生，想了解${core}。` : `As a student, could you tell me about ${topicCore}?`,
    )
  }

  if (!zh) {
    const openerPool = isCourseCodeQuery
      ? [
          topic => `Could you tell me more about ${topic}?`,
          topic => `I am trying to understand ${topic}.`,
          topic => `How do I interpret ${topic}?`,
          topic => `How would you explain ${topic} in simple terms?`,
        ]
      : [
          topic => `Could you tell me more about ${topic}?`,
          topic => `I am wondering about ${topic}.`,
          topic => `I am trying to learn about ${topic}.`,
          topic => `How do I make sense of ${topic}?`,
        ]
    const openerSeed = hashBucket(core, openerPool.length)
    for (let offset = 0; offset < openerPool.length; offset += 1) {
      const style = openerPool[(openerSeed + offset) % openerPool.length]
      const sentence = style(topicCore)
      if (sentence) variants.unshift(sentence)
    }
  }

  return variants
}

function makeCanonicalQuestion(question, tags = []) {
  const q = String(question || '').trim()
  if (!q) return q

  const topicHint = Array.isArray(tags) ? tags.join(' ') : ''
  const lower = q.toLowerCase()
  const isCourseCodeQuery = /\b(course code|course codes|what does|what do|mean|means|cover|covers|covered|stand for)\b/i.test(q)
  const family = (() => {
    if (/\b(contact|address|phone|email|location|where is|where are|how do i contact)\b/i.test(topicHint + ' ' + q)) return 'contact'
    if (/\b(tuition|fee|fees|cost|price|payment|bill|budget)\b/i.test(topicHint + ' ' + q)) return 'tuition'
    if (/\b(admission|admissions|apply|application|enroll|enrollment|enrolment|deadline|requirements)\b/i.test(topicHint + ' ' + q)) return 'admissions'
    if (/\b(homestay|residence|boarding|living|meal|lunch|transport|commute|winter)\b/i.test(topicHint + ' ' + q)) return 'life'
    if (/\b(schedule|timetable|period|class time|what time|when does|when is class)\b/i.test(topicHint + ' ' + q)) return 'schedule'
    if (/\b(alumni|graduate|graduation|placement|university|college|destination)\b/i.test(topicHint + ' ' + q)) return 'outcomes'
    if (isCourseCodeQuery) return 'course'
    return 'general'
  })()

  const normalize = text => normalizeCourseCodeCasing(lowerFirst(text))
  const topicCore = (() => {
    let value = normalize(
      q
        .replace(/[?.!;:]+$/g, '')
        .replace(/^(could you|can you|would you|please|i would like to|i want to|i am wondering about|i need help with)\s+/i, '')
        .replace(/^(what is|what are|what do|what does|where is|where are|when is|when are|who is|who are|how many|how much|how long|how far|how old|why is|why are|do|does|did|can|could|should|would|will|is|are|am|was|were)\s+/i, '')
        .replace(/\s+(mean|means|meaning|cover|covers|covered|include|includes|require|requires|look like|looks like)\s*$/i, '')
        .trim(),
    )
    const normalized = value.toLowerCase()
    if (/^credits do i need for the ossd$/.test(normalized)) value = 'the number of credits required for the OSSD'
    else if (/^compulsory credits are part of the ossd$/.test(normalized)) value = 'the compulsory credits that are part of the OSSD'
    else if (/^ossd graduation requirements$/.test(normalized)) value = 'the OSSD graduation requirements'
    else if (/^ossd literacy requirement$/.test(normalized)) value = 'the OSSD literacy requirement'
    else if (/^community involvement hours are required for the ossd$/.test(normalized)) value = 'the community involvement hours required for the OSSD'
    else if (/^online learning credits are required for the ossd$/.test(normalized)) value = 'the online learning credits required for the OSSD'
    else if (/^graduates go to schools like u of t, waterloo, and york$/.test(normalized)) value = 'graduate destinations at schools like U of T, Waterloo, and York'
    else if (/^ontario course codes like [a-z0-9]+$/.test(normalized)) value = value.replace(/^ontario course codes like\s+/i, 'Ontario course codes like ')
    else if (/^[a-z]{3}\d[ucmof]$/.test(normalized)) value = value.toUpperCase()
    return value
  })()

  const pools = {
    course: [
      topic => `What does ${topic} mean?`,
      topic => `What does ${topic} cover?`,
      topic => `How should I understand ${topic}?`,
      topic => `Can you help me make sense of ${topic}?`,
      topic => `How would you explain ${topic} to a parent?`,
      topic => `How would you explain ${topic} to a student?`,
      topic => `Could you summarize ${topic}?`,
      topic => `How is ${topic} usually taught?`,
      topic => `What matters most in ${topic}?`,
      topic => `What should a parent focus on in ${topic}?`,
      topic => `What should a student focus on in ${topic}?`,
      topic => `Can you put ${topic} in plain English?`,
    ],
    contact: [
      topic => `How do I contact the school about ${topic}?`,
      topic => `Where can I find the school's ${topic}?`,
      topic => `Could you give me the ${topic} for the school?`,
      topic => `How do I get the school's ${topic}?`,
      topic => `How do I reach the school?`,
      topic => `Who should I contact about ${topic}?`,
    ],
    tuition: [
      topic => `How much is ${topic}?`,
      topic => `What does ${topic} include?`,
      topic => `What fees should families expect?`,
      topic => `How much should we budget for ${topic}?`,
      topic => `How much does ${topic} cost in total?`,
      topic => `Are there any extra fees for ${topic}?`,
    ],
    admissions: [
      topic => `How do I apply for ${topic}?`,
      topic => `What are the admission requirements for ${topic}?`,
      topic => `What documents do I need for ${topic}?`,
      topic => `When is the deadline for ${topic}?`,
      topic => `What steps are involved in ${topic}?`,
      topic => `How does the application process for ${topic} work?`,
    ],
    life: [
      topic => `What is student life like for ${topic}?`,
      topic => `How does ${topic} work?`,
      topic => `What should students expect for ${topic}?`,
      topic => `What support is available for ${topic}?`,
      topic => `How should a family prepare for ${topic}?`,
      topic => `What are the practical details of ${topic}?`,
    ],
    schedule: [
      topic => `What does the school schedule look like for ${topic}?`,
      topic => `When does ${topic} happen?`,
      topic => `What time is ${topic}?`,
      topic => `How is ${topic} arranged?`,
      topic => `What should I know about ${topic} timing?`,
      topic => `When do classes start and end for ${topic}?`,
    ],
    outcomes: [
      topic => `Where do graduates go after ${topic}?`,
      topic => `What are the graduate outcomes for ${topic}?`,
      topic => `How strong is the university placement for ${topic}?`,
      topic => `Which universities do graduates typically attend after ${topic}?`,
      topic => `What should families know about outcomes after ${topic}?`,
      topic => `How does the school support ${topic}?`,
    ],
    general: [
      topic => `Could you tell me about ${topic}?`,
      topic => `I would like to know more about ${topic}.`,
      topic => `Can you explain ${topic}?`,
      topic => `What should I know about ${topic}?`,
      topic => `Could you walk me through ${topic}?`,
      topic => `How should I think about ${topic}?`,
      topic => `How does ${topic} work in practice?`,
      topic => `How does ${topic} work in real life?`,
      topic => `What matters most about ${topic}?`,
      topic => `Can you give me the short version of ${topic}?`,
    ],
  }

  const pool = pools[family] || pools.general
  return pool[hashBucket(q, pool.length)](topicCore)
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
      question: makeCanonicalQuestion(source.question, source.tags),
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
