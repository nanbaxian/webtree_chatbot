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
    if (/\b(address|location|where is|where are|campus)\b/i.test(topicHint + ' ' + q)) return 'contact_address'
    if (/\b(phone|call|contact number|telephone)\b/i.test(topicHint + ' ' + q)) return 'contact_phone'
    if (/\b(email|mail|contact email)\b/i.test(topicHint + ' ' + q)) return 'contact_email'
    if (/\b(contact|reach the school|how do i contact|who should i contact)\b/i.test(topicHint + ' ' + q)) return 'contact_general'
    if (/\b(refund|refunds|withdraw|withdrawal|payment|pay|billing|invoice|bill|budget|cost|price)\b/i.test(topicHint + ' ' + q)) return 'tuition_payment'
    if (/\b(tuition|fee|fees|cost|price|budget)\b/i.test(topicHint + ' ' + q)) return 'tuition_general'
    if (/\b(application fee|application fees)\b/i.test(topicHint + ' ' + q)) return 'tuition_application'
    if (/\b(scholarship|bursary|financial aid)\b/i.test(topicHint + ' ' + q)) return 'tuition_aid'
    if (/\b(deadline|due date|timeline|when is|when do|last day)\b/i.test(topicHint + ' ' + q)) return 'admissions_deadline'
    if (/\b(document|documents|transcript|report card|passport|reference|recommendation|portfolio)\b/i.test(topicHint + ' ' + q)) return 'admissions_docs'
    if (/\b(interview|assessment|test|testing|evaluation)\b/i.test(topicHint + ' ' + q)) return 'admissions_assessment'
    if (/\b(apply|application|admission|admissions|enroll|enrollment|enrolment|requirements)\b/i.test(topicHint + ' ' + q)) return 'admissions_general'
    if (/\b(homestay|residence|boarding|living|meal|lunch|cafeteria|transport|commute|winter|dress|climate|support|counseling|counselling)\b/i.test(topicHint + ' ' + q)) return 'life_general'
    if (/\b(homestay|boarding family)\b/i.test(topicHint + ' ' + q)) return 'life_homestay'
    if (/\b(residence|dorm|dormitory)\b/i.test(topicHint + ' ' + q)) return 'life_residence'
    if (/\b(meal|lunch|cafeteria|food)\b/i.test(topicHint + ' ' + q)) return 'life_meals'
    if (/\b(commute|transport|bus|pickup|dropoff|winter)\b/i.test(topicHint + ' ' + q)) return 'life_commute'
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
    contact_address: [
      topic => `Where is the school located?`,
      topic => `What is the school's address?`,
      topic => `How do I find the campus address?`,
      topic => `Which address should families use for ${topic}?`,
    ],
    contact_phone: [
      topic => `What is the school's phone number?`,
      topic => `How do I call the school?`,
      topic => `What number should I use to reach the school?`,
      topic => `Is there a direct line for the school?`,
    ],
    contact_email: [
      topic => `What is the school's email address?`,
      topic => `How do I email the school?`,
      topic => `Which email should families use?`,
      topic => `Is there a contact email for the school?`,
    ],
    contact_general: [
      topic => `How do I contact the school?`,
      topic => `Who should I contact at the school?`,
      topic => `What is the best way to reach the school?`,
      topic => `How do families usually get in touch?`,
    ],
    tuition_payment: [
      topic => `How should we pay the tuition?`,
      topic => `What payment options are available?`,
      topic => `Can tuition be paid in installments?`,
      topic => `What is the refund policy if we withdraw?`,
      topic => `Are there any payment deadlines?`,
    ],
    tuition_application: [
      topic => `How much is the application fee?`,
      topic => `Is there an application fee?`,
      topic => `What does the application fee cover?`,
      topic => `Do we need to pay anything to apply?`,
    ],
    tuition_aid: [
      topic => `Are scholarships available?`,
      topic => `What financial aid options are there?`,
      topic => `Is there any bursary support?`,
      topic => `How can families apply for aid?`,
    ],
    tuition_general: [
      topic => `How much is ${topic}?`,
      topic => `What does ${topic} include?`,
      topic => `How much should we budget for ${topic}?`,
      topic => `How much does ${topic} cost in total?`,
      topic => `Are there any extra fees for ${topic}?`,
    ],
    admissions_deadline: [
      topic => `When is the deadline to apply?`,
      topic => `What is the application deadline?`,
      topic => `When do applications close?`,
      topic => `Is there a deadline families should know?`,
    ],
    admissions_docs: [
      topic => `What documents do I need to apply?`,
      topic => `Which documents should we prepare?`,
      topic => `What paperwork is required?`,
      topic => `What should families submit with the application?`,
    ],
    admissions_assessment: [
      topic => `Is there an interview or assessment?`,
      topic => `Do students need to be interviewed or tested?`,
      topic => `What evaluation steps are involved?`,
      topic => `How does the assessment process work?`,
    ],
    admissions_general: [
      topic => `How do I apply?`,
      topic => `What are the admission requirements?`,
      topic => `What steps are involved in the application process?`,
      topic => `How does enrollment work?`,
      topic => `What should families know before applying?`,
    ],
    life_homestay: [
      topic => `How does homestay work?`,
      topic => `What is homestay like for students?`,
      topic => `How are homestay families arranged?`,
      topic => `What should parents know about homestay?`,
    ],
    life_residence: [
      topic => `What is residence life like?`,
      topic => `How does student housing work?`,
      topic => `What should students expect in residence?`,
      topic => `What are the residence options?`,
    ],
    life_meals: [
      topic => `How are meals handled?`,
      topic => `What are the lunch options?`,
      topic => `Is food provided for students?`,
      topic => `What should families know about meals?`,
    ],
    life_commute: [
      topic => `How do students get to school?`,
      topic => `What are the commute options?`,
      topic => `Is transportation provided?`,
      topic => `How should families plan for winter commuting?`,
    ],
    life_general: [
      topic => `What is student life like?`,
      topic => `What should students expect day to day?`,
      topic => `What support is available for students?`,
      topic => `How should a family prepare for school life?`,
      topic => `What are the practical details families should know?`,
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
      const combined = `${question} ${answer}`.toLowerCase()
      let priority = Number.isFinite(Number(qa.priority)) ? Number(qa.priority) : 0
      if (/\b(address|phone|email|location|contact|campus)\b/i.test(combined)) priority += 500
      if (/\b(tuition|fee|fees|cost|price|payment|refund|scholarship|bursary|financial aid)\b/i.test(combined)) priority += 400
      if (/\b(apply|application|admission|admissions|deadline|documents|interview|assessment|enroll|enrollment|enrolment)\b/i.test(combined)) priority += 300
      if (/\b(homestay|residence|boarding|lunch|meal|commute|transport|winter|support|student life)\b/i.test(combined)) priority += 250
      pairs.push({
        source_file: file,
        question,
        answer,
        tags: Array.isArray(qa.tags) ? qa.tags.map(String) : [],
        priority,
      })
    }
  }
  return pairs.sort((left, right) => {
    const priorityDelta = (right.priority || 0) - (left.priority || 0)
    if (priorityDelta !== 0) return priorityDelta
    const fileDelta = left.source_file.localeCompare(right.source_file)
    if (fileDelta !== 0) return fileDelta
    return left.question.localeCompare(right.question)
  })
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
