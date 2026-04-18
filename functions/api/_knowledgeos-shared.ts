const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

export function options(): Response {
  return new Response(null, { headers: cors })
}

export function sbHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
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

export async function listTable<T>(
  supabaseUrl: string | undefined,
  supabaseKey: string | undefined,
  table: string,
  query = '',
): Promise<T[] | null> {
  if (!supabaseUrl || !supabaseKey) return null
  const suffix = query ? `?${query}` : ''
  const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${table}${suffix}`, {
    headers: sbHeaders(supabaseKey),
  })
  if (!res.ok) return null
  return (await res.json()) as T[]
}

export async function mutateTable<T>(
  supabaseUrl: string | undefined,
  supabaseKey: string | undefined,
  table: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
  query = '',
): Promise<T[] | null> {
  if (!supabaseUrl || !supabaseKey) return null
  const suffix = query ? `?${query}` : ''
  const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${table}${suffix}`, {
    method,
    headers: sbHeaders(supabaseKey),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) return null
  return (await res.json()) as T[]
}

export function demoTenant(tenantId: string) {
  return {
    id: tenantId,
    name: 'KnowledgeOS Demo Tenant',
    slug: 'knowledgeos-demo',
    plan: 'starter',
    status: 'active',
    created_at: new Date().toISOString(),
  }
}
