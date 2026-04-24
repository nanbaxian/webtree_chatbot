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

function articleize(text) {
  const value = String(text || '').trim()
  if (!value) return value
  if (/^(the|a|an)\b/i.test(value)) return value
  if (/^[A-Z][A-Za-z0-9-]+/.test(value) && !/\b(tuition|fee|fees|cost|costs|price|payment|refund|deadline|documents|admission|application|homestay|residence|meal|meals|commute|contact|phone|email)\b/i.test(value)) return value
  return `the ${value}`
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
  const family = (() => {
    const combined = `${topicHint} ${q}`.toLowerCase()
    if (/\b(homestay|residence|boarding|living|meal|lunch|cafeteria|transport|commute|winter|dress|climate|support|counseling|counselling|housing|student life|meals|food|wellbeing)\b/i.test(combined)) return 'life'
    if (/\b(address|location|where is|where are|campus|phone|call|contact number|telephone|email|mail|contact email|contact|reach the school|how do i contact|who should i contact)\b/i.test(combined)) return 'contact'
    if (/\b(refund|withdraw|payment|pay|billing|invoice|bill|budget|cost|price|tuition|fee|fees|scholarship|bursary|financial aid|application fee)\b/i.test(combined)) return 'tuition'
    if (/\b(apply|application|admission|admissions|deadline|documents|interview|assessment|enroll|enrollment|enrolment|requirements)\b/i.test(combined)) return 'admissions'
    if (/\b(schedule|timetable|period|class time|what time|when does|when is class)\b/i.test(combined)) return 'schedule'
    if (/\b(alumni|graduate|graduation|placement|university|college|destination)\b/i.test(combined)) return 'outcomes'
    return 'general'
  })()
  let topicCore = lowerFirst(
      core
        .replace(/[?.!;:]+$/g, '')
        .replace(/^(could you|can you|would you|please|i would like to|i want to|i am wondering about|i need help with)\s+/i, '')
        .replace(/^(what is|what are|what do|what does|where is|where are|when is|when are|who is|who are|how many|how much|how long|how far|how old|why is|why are|do|does|did|can|could|should|would|will|is|are|am|was|were)\s+/i, '')
        .replace(/^(is|are|am|was|were|do|does|did|can|could|should|would|will|have|has|had|there)\s+/i, '')
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
  const familyStyles = {
    life: [
      topic => `How does ${topic} work?`,
      topic => `What should families know about ${topic}?`,
      topic => `What are the main details of ${topic}?`,
      topic => `How should a parent think about ${topic}?`,
      topic => `How should a student think about ${topic}?`,
      topic => `What practical details matter most for ${topic}?`,
      topic => `Can you explain ${topic} in simple terms?`,
      topic => `What should we expect with ${topic}?`,
    ],
    contact: [
      topic => `What is the best way to contact the school?`,
      topic => `Who should families contact?`,
      topic => `What phone number should families use?`,
      topic => `What email should families use?`,
      topic => `Where is the school located?`,
      topic => `What contact details matter most?`,
      topic => `How do families usually reach the school?`,
      topic => `What is the main office contact information?`,
    ],
    tuition: [
      topic => `How much is ${articleize(topic)}?`,
      topic => `What does ${topic} include?`,
      topic => `How should families budget for ${topic}?`,
      topic => `What payment options are available?`,
      topic => `Are there any extra fees?`,
      topic => `Are scholarships or bursaries available?`,
      topic => `What is the refund policy?`,
      topic => `How much should we expect to pay in total?`,
    ],
    admissions: [
      topic => `What are the admission requirements?`,
      topic => `When is the application deadline?`,
      topic => `What documents do we need to apply?`,
      topic => `Is there an interview or assessment?`,
      topic => `How does the application process work?`,
      topic => `What should families prepare first?`,
      topic => `How does enrollment work?`,
      topic => `What should we know before applying?`,
    ],
    schedule: [
      topic => `What is the schedule for ${topic}?`,
      topic => `When does ${topic} happen?`,
      topic => `What time is ${topic}?`,
      topic => `How is ${topic} arranged?`,
      topic => `How does the timetable work for ${topic}?`,
    ],
    outcomes: [
      topic => `Where do graduates go after ${topic}?`,
      topic => `What are the graduate outcomes for ${topic}?`,
      topic => `Which universities do graduates typically attend?`,
      topic => `How strong is the university placement?`,
      topic => `What should families know about outcomes?`,
    ],
  }

  const englishPool = isCourseCodeQuery ? courseStyles : (familyStyles[family] || generalStyles)
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
          topic => `I want to learn about ${topic}.`,
          topic => `Can you help me understand ${topic}?`,
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
        .replace(/^(is|are|am|was|were|do|does|did|can|could|should|would|will|have|has|had|there)\s+/i, '')
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
    if (/^(is|are|am|was|were|do|does|did|can|could|should|would|will|have|has|had|there)\s+/i.test(value)) {
      value = value.replace(/^(is|are|am|was|were|do|does|did|can|could|should|would|will|have|has|had|there)\s+/i, '')
    }
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

function buildSupplementalPairs() {
  const items = [
    {
      question: 'Homestay for international students',
      answer:
        'Homestay usually means a student lives with a local host family under a school-approved arrangement. Families should confirm meals, curfew expectations, transportation, supervision, and emergency contacts before the student arrives.',
      tags: ['life', 'life_homestay', 'student_life'],
      priority: 990,
    },
    {
      question: 'Homestay expectations',
      answer:
        'Parents should ask how the host family is screened, what meals are included, who handles transportation, and how the school supports communication if concerns come up. It also helps to confirm bedroom setup, internet access, and weekly routines in advance.',
      tags: ['life', 'life_homestay', 'student_life'],
      priority: 989,
    },
    {
      question: 'Student housing options',
      answer:
        'Student housing is usually arranged through residence, homestay, or an independent living option depending on the school. The main things to confirm are supervision, meals, transportation, safety, and how quickly the school can help if a student needs support.',
      tags: ['life', 'life_residence', 'student_life'],
      priority: 988,
    },
    {
      question: 'Residence life',
      answer:
        'Residence life typically includes shared rules for quiet hours, meals, check-in procedures, and student supervision. Families should confirm what is included, who is on duty, and how the school responds after hours if a student needs help.',
      tags: ['life', 'life_residence', 'student_life'],
      priority: 987,
    },
    {
      question: 'Daily student life',
      answer:
        'Students usually move between classes, lunch, study time, activities, and communication with teachers or staff. It helps to know the daily schedule, homework expectations, attendance rules, and what support is available if the student needs academic or personal help.',
      tags: ['life', 'life_general', 'student_life'],
      priority: 986,
    },
    {
      question: 'Student support services',
      answer:
        'Schools often provide academic help, guidance support, attendance follow-up, and a point of contact for student concerns. Families should confirm who handles academic questions, who handles student wellbeing, and how to request help when needed.',
      tags: ['life', 'life_general', 'support', 'student_life'],
      priority: 985,
    },
    {
      question: 'School life in Canada',
      answer:
        'Families should review the school schedule, transportation plan, weather expectations, meal routines, and communication channels before the first day. It also helps to confirm attendance rules, emergency contacts, and whether the student needs any extra support while adjusting.',
      tags: ['life', 'life_general', 'student_life'],
      priority: 984,
    },
    {
      question: 'Student commute',
      answer:
        'Students may commute by family drop-off, public transit, walking, or a school-arranged transportation option if available. Families should check the daily route, travel time, winter weather plan, and what happens if a student arrives late.',
      tags: ['life', 'life_commute', 'student_life'],
      priority: 983,
    },
    {
      question: 'Winter commuting',
      answer:
        'Winter commuting usually means planning extra time, checking weather alerts, and making sure the student has appropriate clothing and a reliable backup plan. Families should also confirm how the school handles delays, cancellations, and late arrivals during bad weather.',
      tags: ['life', 'life_commute', 'student_life'],
      priority: 982,
    },
    {
      question: 'Meal plans',
      answer:
        'Meal arrangements vary by school and housing type. Families should confirm whether lunch is included, whether snacks or dinner are covered, and how dietary restrictions, allergies, or special meal needs are handled.',
      tags: ['life', 'life_meals', 'student_life'],
      priority: 981,
    },
    {
      question: 'Lunch options',
      answer:
        'Lunch options may include bringing food from home, buying food nearby, or using a school meal plan if one exists. It is a good idea to ask about food safety, supervision during lunch, and how the school handles allergies or special diets.',
      tags: ['life', 'life_meals', 'student_life'],
      priority: 980,
    },
    {
      question: 'Daily routines',
      answer:
        'Families usually handle day-to-day details by confirming the schedule, transportation, food plan, communication method, and who to contact for support. A clear routine helps students settle in faster and reduces confusion during the first few weeks.',
      tags: ['life', 'life_general', 'student_life'],
      priority: 979,
    },
    {
      question: 'School contact information',
      answer:
        'The best contact method depends on whether the question is urgent or administrative. Families should confirm the school email, main phone number, office hours, and which staff member handles admissions or academic questions.',
      tags: ['contact', 'contact_general'],
      priority: 978,
    },
    {
      question: 'School phone number',
      answer:
        'The school phone number is the best direct line for urgent questions or when families need a quick answer. It is helpful to ask which extension or office hours to use for admissions, attendance, or student support.',
      tags: ['contact', 'contact_phone'],
      priority: 977,
    },
    {
      question: 'School email address',
      answer:
        'The school email address is usually the best place to send documents, application questions, or follow-up requests. Families should also ask which email is used for admissions, which is used for general inquiries, and how quickly replies are usually sent.',
      tags: ['contact', 'contact_email'],
      priority: 976,
    },
    {
      question: 'School location',
      answer:
        'The school location matters because it affects commute time, transit options, and whether the campus is easy for families to visit. Parents should confirm the full address, nearby landmarks, and parking or pickup details if needed.',
      tags: ['contact', 'contact_address'],
      priority: 975,
    },
    {
      question: 'Total tuition cost',
      answer:
        'Families should ask for the full tuition total and confirm whether books, uniforms, activities, housing, insurance, and application fees are separate. It is best to check the full annual cost before comparing schools.',
      tags: ['tuition', 'tuition_general'],
      priority: 974,
    },
    {
      question: 'Tuition payment options',
      answer:
        'Schools may offer bank transfer, credit card, installment plans, or other payment methods. Families should confirm due dates, late fees, refunds, and whether tuition can be split across terms.',
      tags: ['tuition', 'tuition_payment'],
      priority: 973,
    },
    {
      question: 'Application fee',
      answer:
        'Many schools charge an application fee, and families should confirm whether it is refundable or applied toward the first term. It is also useful to ask whether the fee changes for domestic and international applicants.',
      tags: ['tuition', 'tuition_application'],
      priority: 972,
    },
    {
      question: 'Scholarships and bursaries',
      answer:
        'Some schools offer scholarships, bursaries, or other financial aid options for eligible students. Families should ask what the criteria are, when to apply, and whether the award applies to tuition only or to other costs as well.',
      tags: ['tuition', 'tuition_aid'],
      priority: 971,
    },
    {
      question: 'Application deadline',
      answer:
        'Application deadlines can vary depending on the program, grade, and whether the student is applying from inside or outside Canada. Families should confirm the deadline early so they have enough time to gather documents and complete assessments.',
      tags: ['admissions', 'admissions_deadline'],
      priority: 970,
    },
    {
      question: 'Application documents',
      answer:
        'Most applications require a transcript, passport or ID, application form, and sometimes a reference or report card. Families should ask for the exact document list so nothing important is missed before submitting the application.',
      tags: ['admissions', 'admissions_docs'],
      priority: 969,
    },
    {
      question: 'Interview or assessment',
      answer:
        'Many schools use an interview, placement test, or academic assessment to understand the student’s level and fit. Families should ask how long the assessment takes, whether it is online or in person, and what subjects are involved.',
      tags: ['admissions', 'admissions_assessment'],
      priority: 968,
    },
    {
      question: 'Application process',
      answer:
        'The application process usually starts with an inquiry or form submission, followed by document review and possibly an interview or placement step. Families should confirm the full sequence and whether there are separate steps for domestic and international students.',
      tags: ['admissions', 'admissions_general'],
      priority: 967,
    },
  ]

  return items.map((item, index) => ({
    source_file: 'supplemental_life_seed',
    question: item.question,
    answer: item.answer,
    tags: item.tags,
    priority: item.priority,
    supplemental: true,
    order: index,
  }))
}

async function main() {
  const sourcePairs = [...buildSupplementalPairs(), ...(await loadSourcePairs())]
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
