export type D1Env = { DB?: D1Database }

export type D1Tenant = {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  created_at: string
  updated_at: string
}

export type D1Bot = {
  id: string
  tenant_id: string
  name: string
  persona: string
  tone: string
  welcome_msg: string
  fallback_msg: string
  language: string
  settings_json: string
  created_at: string
  updated_at: string
}

export type D1Conversation = {
  id: string
  tenant_id: string
  bot_id: string
  created_by: string | null
  title: string
  channel: string
  created_at: string
  updated_at: string
}

export type D1Message = {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model: string | null
  input_tokens: number
  output_tokens: number
  created_at: string
}

export type D1Source = {
  id: string
  tenant_id: string
  bot_id: string | null
  type: string
  name: string
  config_json: string
  status: string
  created_at: string
  updated_at: string
}

export type D1Document = {
  id: string
  tenant_id: string
  source_id: string | null
  title: string
  file_name: string | null
  r2_key: string | null
  status: string
  error_msg: string | null
  version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type D1Member = {
  tenant_id: string
  user_id: string
  role: 'admin' | 'member' | 'viewer'
  invited_at: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
}

export type D1UsageLog = {
  id: string
  tenant_id: string
  bot_id: string | null
  date: string
  input_tokens: number
  output_tokens: number
  messages_count: number
  queries_count: number
  created_at: string
}

export type D1RetrievalLog = {
  id: string
  tenant_id: string
  bot_id: string | null
  query: string
  chunks_retrieved: number
  rerank_scores: string
  latency_ms: number
  created_at: string
}

function isoNow(): string {
  return new Date().toISOString()
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {})
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function readTenantId(request: Request): string {
  const header = request.headers.get('x-tenant-id')?.trim()
  if (header) return header
  const url = new URL(request.url)
  const query = url.searchParams.get('tenant_id')?.trim()
  if (query) return query
  return 'tenant_demo'
}

export function tenantSeed(tenantId: string): D1Tenant {
  const now = isoNow()
  return {
    id: tenantId,
    name: 'KnowledgeOS Demo Tenant',
    slug: 'knowledgeos-demo',
    plan: 'starter',
    status: 'active',
    created_at: now,
    updated_at: now,
  }
}

export function botSeed(tenantId: string, overrides: Partial<D1Bot> = {}): D1Bot {
  const now = isoNow()
  return {
    id: overrides.id ?? `bot_${tenantId}`,
    tenant_id: tenantId,
    name: overrides.name ?? 'KnowledgeOS Assistant',
    persona: overrides.persona ?? 'Professional and concise',
    tone: overrides.tone ?? 'concise',
    welcome_msg: overrides.welcome_msg ?? 'Hello, how can I help?',
    fallback_msg: overrides.fallback_msg ?? 'I could not find a matching source.',
    language: overrides.language ?? 'zh-CN',
    settings_json: overrides.settings_json ?? stringifyJson({
      max_history_turns: 10,
      citation_display: true,
      retrieval_top_k: 8,
    }),
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  }
}

export function conversationSeed(tenantId: string, botId: string, title = 'New conversation'): D1Conversation {
  const now = isoNow()
  return {
    id: `conv_${crypto.randomUUID()}`,
    tenant_id: tenantId,
    bot_id: botId,
    created_by: null,
    title,
    channel: 'dashboard',
    created_at: now,
    updated_at: now,
  }
}

export async function dbAll<T>(env: D1Env, sql: string, params: unknown[] = []): Promise<T[] | null> {
  if (!env.DB) return null
  const stmt = params.length ? env.DB.prepare(sql).bind(...params) : env.DB.prepare(sql)
  const result = await stmt.all<T>()
  return result.results
}

export async function dbFirst<T>(env: D1Env, sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await dbAll<T>(env, sql, params)
  return rows?.[0] ?? null
}

export async function dbRun(env: D1Env, sql: string, params: unknown[] = []): Promise<boolean> {
  if (!env.DB) return false
  const stmt = params.length ? env.DB.prepare(sql).bind(...params) : env.DB.prepare(sql)
  await stmt.run()
  return true
}

export async function upsertTenant(env: D1Env, tenant: D1Tenant): Promise<D1Tenant | null> {
  if (!env.DB) return null
  const rows = await dbAll<D1Tenant>(
    env,
    `INSERT INTO tenants (id, name, slug, plan, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       slug=excluded.slug,
       plan=excluded.plan,
       status=excluded.status,
       updated_at=excluded.updated_at
     RETURNING *`,
    [tenant.id, tenant.name, tenant.slug, tenant.plan, tenant.status, tenant.created_at, tenant.updated_at],
  )
  return rows?.[0] ?? null
}

export async function getTenant(env: D1Env, tenantId: string): Promise<D1Tenant | null> {
  return dbFirst<D1Tenant>(env, `SELECT id, name, slug, plan, status, created_at, updated_at FROM tenants WHERE id = ? LIMIT 1`, [tenantId])
}

export async function listBots(env: D1Env, tenantId: string): Promise<D1Bot[] | null> {
  return dbAll<D1Bot>(env, `SELECT * FROM bots WHERE tenant_id = ? ORDER BY created_at ASC`, [tenantId])
}

export async function upsertBot(env: D1Env, bot: D1Bot): Promise<D1Bot | null> {
  if (!env.DB) return null
  const rows = await dbAll<D1Bot>(
    env,
    `INSERT INTO bots (id, tenant_id, name, persona, tone, welcome_msg, fallback_msg, language, settings_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       tenant_id=excluded.tenant_id,
       name=excluded.name,
       persona=excluded.persona,
       tone=excluded.tone,
       welcome_msg=excluded.welcome_msg,
       fallback_msg=excluded.fallback_msg,
       language=excluded.language,
       settings_json=excluded.settings_json,
       updated_at=excluded.updated_at
     RETURNING *`,
    [bot.id, bot.tenant_id, bot.name, bot.persona, bot.tone, bot.welcome_msg, bot.fallback_msg, bot.language, bot.settings_json, bot.created_at, bot.updated_at],
  )
  return rows?.[0] ?? null
}

export async function getBot(env: D1Env, botId: string): Promise<D1Bot | null> {
  return dbFirst<D1Bot>(env, `SELECT * FROM bots WHERE id = ? LIMIT 1`, [botId])
}

export async function deleteBot(env: D1Env, botId: string): Promise<boolean> {
  return dbRun(env, `DELETE FROM bots WHERE id = ?`, [botId])
}

export async function getDefaultBot(env: D1Env, tenantId: string): Promise<D1Bot | null> {
  const rows = await listBots(env, tenantId)
  if (rows?.[0]) return rows[0]
  return null
}

export async function listSources(env: D1Env, tenantId: string): Promise<D1Source[] | null> {
  return dbAll<D1Source>(env, `SELECT * FROM data_sources WHERE tenant_id = ? ORDER BY created_at DESC`, [tenantId])
}

export async function upsertSource(env: D1Env, source: D1Source): Promise<D1Source | null> {
  if (!env.DB) return null
  const rows = await dbAll<D1Source>(
    env,
    `INSERT INTO data_sources (id, tenant_id, bot_id, type, name, config_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       tenant_id=excluded.tenant_id,
       bot_id=excluded.bot_id,
       type=excluded.type,
       name=excluded.name,
       config_json=excluded.config_json,
       status=excluded.status,
       updated_at=excluded.updated_at
     RETURNING *`,
    [source.id, source.tenant_id, source.bot_id, source.type, source.name, source.config_json, source.status, source.created_at, source.updated_at],
  )
  return rows?.[0] ?? null
}

export async function getSource(env: D1Env, sourceId: string): Promise<D1Source | null> {
  return dbFirst<D1Source>(env, `SELECT * FROM data_sources WHERE id = ? LIMIT 1`, [sourceId])
}

export async function deleteSource(env: D1Env, sourceId: string): Promise<boolean> {
  return dbRun(env, `DELETE FROM data_sources WHERE id = ?`, [sourceId])
}

export async function listDocuments(env: D1Env, tenantId: string): Promise<D1Document[] | null> {
  return dbAll<D1Document>(env, `SELECT * FROM documents WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`, [tenantId])
}

export async function upsertDocument(env: D1Env, doc: D1Document): Promise<D1Document | null> {
  if (!env.DB) return null
  const rows = await dbAll<D1Document>(
    env,
    `INSERT INTO documents (id, tenant_id, source_id, title, file_name, r2_key, status, error_msg, version, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       tenant_id=excluded.tenant_id,
       source_id=excluded.source_id,
       title=excluded.title,
       file_name=excluded.file_name,
       r2_key=excluded.r2_key,
       status=excluded.status,
       error_msg=excluded.error_msg,
       version=excluded.version,
       updated_at=excluded.updated_at,
       deleted_at=excluded.deleted_at
     RETURNING *`,
    [doc.id, doc.tenant_id, doc.source_id, doc.title, doc.file_name, doc.r2_key, doc.status, doc.error_msg, doc.version, doc.created_at, doc.updated_at, doc.deleted_at],
  )
  return rows?.[0] ?? null
}

export async function getDocument(env: D1Env, documentId: string): Promise<D1Document | null> {
  return dbFirst<D1Document>(env, `SELECT * FROM documents WHERE id = ? LIMIT 1`, [documentId])
}

export async function deleteDocument(env: D1Env, documentId: string): Promise<boolean> {
  return dbRun(env, `UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?`, [isoNow(), isoNow(), documentId])
}

export async function listConversations(env: D1Env, tenantId: string): Promise<D1Conversation[] | null> {
  return dbAll<D1Conversation>(env, `SELECT * FROM conversations WHERE tenant_id = ? ORDER BY updated_at DESC`, [tenantId])
}

export async function getConversation(env: D1Env, conversationId: string): Promise<D1Conversation | null> {
  return dbFirst<D1Conversation>(env, `SELECT * FROM conversations WHERE id = ? LIMIT 1`, [conversationId])
}

export async function deleteConversation(env: D1Env, conversationId: string): Promise<boolean> {
  return dbRun(env, `DELETE FROM conversations WHERE id = ?`, [conversationId])
}

export async function upsertConversation(env: D1Env, conversation: D1Conversation): Promise<D1Conversation | null> {
  if (!env.DB) return null
  const rows = await dbAll<D1Conversation>(
    env,
    `INSERT INTO conversations (id, tenant_id, bot_id, created_by, title, channel, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       tenant_id=excluded.tenant_id,
       bot_id=excluded.bot_id,
       created_by=excluded.created_by,
       title=excluded.title,
       channel=excluded.channel,
       updated_at=excluded.updated_at
     RETURNING *`,
    [conversation.id, conversation.tenant_id, conversation.bot_id, conversation.created_by, conversation.title, conversation.channel, conversation.created_at, conversation.updated_at],
  )
  return rows?.[0] ?? null
}

export async function listMessages(env: D1Env, conversationId: string, limit = 20): Promise<D1Message[] | null> {
  return dbAll<D1Message>(
    env,
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?`,
    [conversationId, limit],
  )
}

export async function insertMessage(env: D1Env, message: D1Message): Promise<D1Message | null> {
  if (!env.DB) return null
  const rows = await dbAll<D1Message>(
    env,
    `INSERT INTO messages (id, conversation_id, role, content, model, input_tokens, output_tokens, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [message.id, message.conversation_id, message.role, message.content, message.model, message.input_tokens, message.output_tokens, message.created_at],
  )
  return rows?.[0] ?? null
}

export async function updateConversationTouch(env: D1Env, conversationId: string, title?: string): Promise<void> {
  if (!env.DB) return
  if (typeof title === 'string' && title.trim()) {
    await dbRun(
      env,
      `UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`,
      [title.trim(), isoNow(), conversationId],
    )
    return
  }
  await dbRun(env, `UPDATE conversations SET updated_at = ? WHERE id = ?`, [isoNow(), conversationId])
}

export async function listMembers(env: D1Env, tenantId: string): Promise<D1Member[] | null> {
  return dbAll<D1Member>(env, `SELECT * FROM tenant_members WHERE tenant_id = ? ORDER BY created_at ASC`, [tenantId])
}

export async function upsertMember(env: D1Env, member: D1Member): Promise<D1Member | null> {
  if (!env.DB) return null
  const rows = await dbAll<D1Member>(
    env,
    `INSERT INTO tenant_members (tenant_id, user_id, role, invited_at, joined_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, user_id) DO UPDATE SET
       role=excluded.role,
       invited_at=excluded.invited_at,
       joined_at=excluded.joined_at,
       updated_at=excluded.updated_at
     RETURNING *`,
    [member.tenant_id, member.user_id, member.role, member.invited_at, member.joined_at, member.created_at, member.updated_at],
  )
  return rows?.[0] ?? null
}

export async function listUsage(env: D1Env, tenantId: string): Promise<D1UsageLog[] | null> {
  return dbAll<D1UsageLog>(env, `SELECT * FROM usage_logs WHERE tenant_id = ? ORDER BY date DESC LIMIT 31`, [tenantId])
}

export async function listRetrievalLogs(env: D1Env, tenantId: string): Promise<D1RetrievalLog[] | null> {
  return dbAll<D1RetrievalLog>(env, `SELECT * FROM retrieval_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50`, [tenantId])
}

export function parseSettings<T>(raw: string | null | undefined, fallback: T): T {
  return parseJson<T>(raw, fallback)
}
