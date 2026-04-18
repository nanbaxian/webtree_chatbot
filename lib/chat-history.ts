import type { ChatSessionDetail, ChatSessionSummary, DbMessage, Persona } from '../types/index'

type SessionRow = {
  id: string
  title: string
  persona_id?: string | null
  session_type: 'text' | 'voice'
  last_message_preview?: string | null
  last_message_at?: string | null
  message_count?: number | null
  is_pinned?: boolean | null
  created_at: string
  updated_at?: string
  personas?: Pick<Persona, 'name' | 'name_en' | 'avatar'> | null
}

function sbHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

function previewText(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > 80 ? `${compact.slice(0, 80)}...` : compact
}

function defaultTitle(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (!compact) return '新对话'
  return compact.length > 24 ? `${compact.slice(0, 24)}...` : compact
}

function mapSession(row: SessionRow): ChatSessionSummary {
  return {
    id: row.id,
    title: row.title || '新对话',
    persona_id: row.persona_id ?? null,
    persona_name: row.personas?.name ?? null,
    persona_name_en: row.personas?.name_en ?? null,
    persona_avatar: row.personas?.avatar ?? null,
    session_type: row.session_type || 'text',
    last_message_preview: row.last_message_preview ?? '',
    last_message_at: row.last_message_at ?? row.created_at,
    message_count: Number(row.message_count ?? 0),
    is_pinned: Boolean(row.is_pinned),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function createChatSession(
  supabaseUrl: string,
  key: string,
  input: {
    title?: string
    persona_id?: string
    session_type?: 'text' | 'voice'
  },
): Promise<ChatSessionSummary> {
  const res = await fetch(`${supabaseUrl}/rest/v1/chat_sessions`, {
    method: 'POST',
    headers: sbHeaders(key),
    body: JSON.stringify({
      title: input.title?.trim() || '新对话',
      persona_id: input.persona_id ?? null,
      session_type: input.session_type ?? 'text',
      last_message_preview: '',
      message_count: 0,
      is_pinned: false,
      last_message_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`create chat session failed: ${await res.text()}`)
  const rows = (await res.json()) as SessionRow[]
  if (!rows[0]) throw new Error('create chat session returned empty response')
  return mapSession(rows[0])
}

export async function listChatSessions(supabaseUrl: string, key: string): Promise<ChatSessionSummary[]> {
  const query = [
    'select=id,title,persona_id,session_type,last_message_preview,last_message_at,message_count,is_pinned,created_at,updated_at,personas(name,name_en,avatar)',
    'order=is_pinned.desc,last_message_at.desc,created_at.desc',
    'limit=100',
  ].join('&')
  const res = await fetch(`${supabaseUrl}/rest/v1/chat_sessions?${query}`, { headers: sbHeaders(key) })
  if (!res.ok) throw new Error(`list chat sessions failed: ${await res.text()}`)
  const rows = (await res.json()) as SessionRow[]
  return rows.map(mapSession)
}

export async function getChatSession(supabaseUrl: string, key: string, sessionId: string): Promise<ChatSessionDetail | null> {
  const sessionRes = await fetch(
    `${supabaseUrl}/rest/v1/chat_sessions?select=id,title,persona_id,session_type,last_message_preview,last_message_at,message_count,is_pinned,created_at,updated_at,personas(name,name_en,avatar)&id=eq.${sessionId}&limit=1`,
    { headers: sbHeaders(key) },
  )
  if (!sessionRes.ok) throw new Error(`get chat session failed: ${await sessionRes.text()}`)
  const sessions = (await sessionRes.json()) as SessionRow[]
  const session = sessions[0]
  if (!session) return null

  const msgRes = await fetch(
    `${supabaseUrl}/rest/v1/messages?select=id,role,content,content_type,image_url,session_id,created_at&session_id=eq.${sessionId}&order=created_at.asc`,
    { headers: sbHeaders(key) },
  )
  if (!msgRes.ok) throw new Error(`get session messages failed: ${await msgRes.text()}`)
  const messages = (await msgRes.json()) as DbMessage[]
  return {
    ...mapSession(session),
    messages,
  }
}

export async function patchChatSession(
  supabaseUrl: string,
  key: string,
  sessionId: string,
  patch: Partial<Pick<ChatSessionSummary, 'title' | 'is_pinned'>>,
): Promise<ChatSessionSummary | null> {
  const res = await fetch(`${supabaseUrl}/rest/v1/chat_sessions?id=eq.${sessionId}`, {
    method: 'PATCH',
    headers: sbHeaders(key),
    body: JSON.stringify({
      ...(typeof patch.title === 'string' ? { title: patch.title.trim() || '新对话' } : {}),
      ...(typeof patch.is_pinned === 'boolean' ? { is_pinned: patch.is_pinned } : {}),
      updated_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`patch chat session failed: ${await res.text()}`)
  return getChatSessionSummary(supabaseUrl, key, sessionId)
}

export async function deleteChatSession(supabaseUrl: string, key: string, sessionId: string): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/messages?session_id=eq.${sessionId}`, {
    method: 'DELETE',
    headers: sbHeaders(key),
  })
  const res = await fetch(`${supabaseUrl}/rest/v1/chat_sessions?id=eq.${sessionId}`, {
    method: 'DELETE',
    headers: sbHeaders(key),
  })
  if (!res.ok) throw new Error(`delete chat session failed: ${await res.text()}`)
}

export async function syncChatSessionFromMessages(
  supabaseUrl: string,
  key: string,
  sessionId: string,
  opts: {
    persona_id?: string
    session_type?: 'text' | 'voice'
    fallbackTitle?: string
  } = {},
): Promise<void> {
  const msgRes = await fetch(
    `${supabaseUrl}/rest/v1/messages?select=id,role,content,created_at&session_id=eq.${sessionId}&order=created_at.asc`,
    { headers: sbHeaders(key) },
  )
  if (!msgRes.ok) throw new Error(`sync chat session messages failed: ${await msgRes.text()}`)
  const messages = (await msgRes.json()) as Array<Pick<DbMessage, 'id' | 'role' | 'content' | 'created_at'>>

  const firstUser = messages.find(m => m.role === 'user')
  const lastMessage = messages[messages.length - 1]

  const title = defaultTitle(firstUser?.content || opts.fallbackTitle || '')
  const lastPreview = lastMessage ? previewText(lastMessage.content) : ''
  const lastAt = lastMessage?.created_at || new Date().toISOString()

  const patchRes = await fetch(`${supabaseUrl}/rest/v1/chat_sessions?id=eq.${sessionId}`, {
    method: 'PATCH',
    headers: sbHeaders(key),
    body: JSON.stringify({
      title,
      persona_id: opts.persona_id ?? null,
      session_type: opts.session_type ?? 'text',
      last_message_preview: lastPreview,
      last_message_at: lastAt,
      message_count: messages.length,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!patchRes.ok) throw new Error(`sync chat session failed: ${await patchRes.text()}`)
}

async function getChatSessionSummary(supabaseUrl: string, key: string, sessionId: string): Promise<ChatSessionSummary | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/chat_sessions?select=id,title,persona_id,session_type,last_message_preview,last_message_at,message_count,is_pinned,created_at,updated_at,personas(name,name_en,avatar)&id=eq.${sessionId}&limit=1`,
    { headers: sbHeaders(key) },
  )
  if (!res.ok) throw new Error(`get chat session summary failed: ${await res.text()}`)
  const rows = (await res.json()) as SessionRow[]
  return rows[0] ? mapSession(rows[0]) : null
}
