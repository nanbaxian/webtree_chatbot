export interface Persona {
  id: string
  name: string
  name_en?: string
  avatar: string
  prompt: string
  prompt_en?: string
  reply_style: 'short' | 'medium' | 'long'
  voice_id?: string
}

export type ReplyLanguage = 'zh' | 'en'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  content_type: 'text' | 'image' | 'voice'
  session_id?: string
  image_preview?: string
  image_url?: string
  is_typing?: boolean
  created_at: string
}

export interface DbMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  content_type: 'text' | 'image' | 'voice'
  session_id?: string
  image_url?: string
  memory_tier?: 'short' | 'mid' | 'long'
  persona_id?: string
  created_at: string
}

export interface CoreMemory {
  id: string
  fact: string
  category: string
  importance: number
  created_at?: string
}

export interface MemorySnapshot {
  id: string
  tier: 'mid' | 'long'
  summary_text: string
  key_facts: string[]
  emotional_tone: string
  clarity_score: number
  period_start: string
  period_end: string
  similarity?: number
}

export interface MemoryContext {
  coreMemories: CoreMemory[]
  midTermSummary: MemorySnapshot[]
  longTermFragments: MemorySnapshot[]
  shortTermMessages: DbMessage[]
  semanticMatches?: MemorySnapshot[]
}

export interface ChatSessionSummary {
  id: string
  title: string
  persona_id?: string | null
  persona_name?: string | null
  persona_name_en?: string | null
  persona_avatar?: string | null
  session_type: 'text' | 'voice'
  last_message_preview: string
  last_message_at: string
  message_count: number
  is_pinned: boolean
  created_at: string
  updated_at?: string
}

export interface ChatSessionDetail extends ChatSessionSummary {
  messages: Message[]
}

export type TenantPlan = 'starter' | 'growth' | 'business' | 'enterprise'
export type TenantStatus = 'active' | 'trialing' | 'past_due' | 'disabled'
export type MemberRole = 'admin' | 'member' | 'viewer'
export type SourceType = 'website' | 'pdf' | 'qa' | 'manual'
export type KnowledgeStatus =
  | 'draft'
  | 'uploaded'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'ready'
  | 'failed'
  | 'archived'
  | 'reindexing'
  | 'queued'
  | 'running'
  | 'completed'

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  status: TenantStatus
  created_at: string
  updated_at?: string
}

export interface UserAccount {
  id: string
  email: string
  name?: string | null
  avatar_url?: string | null
  created_at: string
  updated_at?: string
}

export interface TenantMember {
  tenant_id: string
  user_id: string
  role: MemberRole
  invited_at?: string | null
  joined_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface KnowledgeBot {
  id: string
  tenant_id: string
  name: string
  persona: string
  tone: string
  welcome_msg: string
  fallback_msg: string
  language: string
  settings_json: Record<string, unknown>
  created_at: string
  updated_at?: string
}

export interface DataSource {
  id: string
  tenant_id: string
  bot_id?: string | null
  type: SourceType
  name: string
  config_json: Record<string, unknown>
  status: KnowledgeStatus
  created_at: string
  updated_at?: string
}

export interface KnowledgeDocument {
  id: string
  tenant_id: string
  source_id?: string | null
  title: string
  file_name?: string | null
  r2_key?: string | null
  status: KnowledgeStatus
  error_msg?: string | null
  version: number
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface DocumentChunk {
  id: string
  doc_id: string
  tenant_id: string
  content: string
  title?: string | null
  section?: string | null
  source_url?: string | null
  page_num?: number | null
  token_count: number
  source_type: string
  created_at: string
  updated_at?: string
}

export interface QAPair {
  id: string
  tenant_id: string
  bot_id?: string | null
  question: string
  answer: string
  tags: string[]
  priority: number
  created_at: string
  updated_at?: string
}

export interface Conversation {
  id: string
  tenant_id: string
  bot_id: string
  created_by?: string | null
  title: string
  channel: string
  created_at: string
  updated_at?: string
}

export interface KnowledgeMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string | null
  input_tokens: number
  output_tokens: number
  created_at: string
}

export interface MessageCitation {
  id: string
  message_id: string
  chunk_id?: string | null
  qa_pair_id?: string | null
  score?: number | null
  source_label?: string | null
  source_url?: string | null
  page_num?: number | null
  created_at: string
}

export interface UsageLog {
  id: string
  tenant_id: string
  bot_id?: string | null
  date: string
  input_tokens: number
  output_tokens: number
  messages_count: number
  queries_count: number
  created_at: string
}

export interface RetrievalLog {
  id: string
  tenant_id: string
  bot_id?: string | null
  query: string
  chunks_retrieved: number
  rerank_scores: unknown[]
  latency_ms: number
  created_at: string
}
