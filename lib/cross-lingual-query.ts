import type { ReplyLanguage } from '@/types'

const CJK_RE = /[\u4e00-\u9fff]/

const CROSS_LINGUAL_HINTS: Array<{ pattern: RegExp; terms: string }> = [
  {
    pattern: /(毕业生|毕业去向|去向|走向|升学去向|主要去哪些大学|去了哪些大学|去了哪些学校|大学名单|大学去向|加拿大哪些大学|升学|录取|大学申请)/i,
    terms: 'graduate alumni university placement post-secondary destinations college university admission',
  },
  {
    pattern: /(学费|费用|收费|多少钱|tuition|fees)/i,
    terms: 'tuition fees cost price',
  },
  {
    pattern: /(正规|正式|认证|注册|教育局|教育部|学历|文凭|认可|办学许可|private school|inspected|accredited)/i,
    terms: 'Ministry of Education inspected private school registration accreditation recognized diploma BSID',
  },
  {
    pattern: /(地址|位置|location|campus|在哪里|哪里)/i,
    terms: 'address location campus',
  },
  {
    pattern: /(电话|邮箱|联系|contact|phone|email)/i,
    terms: 'contact phone email',
  },
  {
    pattern: /(课程|选课|课表|上课|时间表|schedule|timetable|class time)/i,
    terms: 'course schedule timetable class time',
  },
  {
    pattern: /(寄宿|homestay|宿舍|住宿|生活|通勤|午餐|餐厅)/i,
    terms: 'homestay boarding residence student life commute lunch cafeteria',
  },
  {
    pattern: /(申请|报考|报名|入学|admission|application|enrollment|enrolment)/i,
    terms: 'admission application enrollment enrolment',
  },
]

export function buildCrossLingualRagQuery(query: string, locale?: ReplyLanguage): string {
  const base = String(query || '').trim()
  if (!base) return base

  if (locale !== 'zh' && !CJK_RE.test(base)) return base

  const hints = new Set<string>()
  for (const rule of CROSS_LINGUAL_HINTS) {
    if (!rule.pattern.test(base)) continue
    for (const token of rule.terms.split(/\s+/)) {
      const value = token.trim()
      if (value) hints.add(value)
    }
  }

  if (hints.size === 0) return base
  return `${base} ${[...hints].join(' ')}`.trim()
}
