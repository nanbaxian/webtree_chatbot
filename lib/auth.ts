// lib/auth.ts
// Verify Supabase JWT by delegating validation to Supabase Auth API.

export type AuthUser = { userId: string; email?: string }

type TokenPayload = {
  iss?: string
  aud?: string
  exp?: number
}

type SupabaseAuthEnv = {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_KEY?: string
  SUPABASE_JWT_ISS?: string
  SUPABASE_JWT_AUD?: string
}

type CfFetchOptions = {
  cacheTtl?: number
  cacheEverything?: boolean
}

function decodeB64urlJson(b64url: string): TokenPayload {
  const bin = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = '='.repeat((4 - (bin.length % 4)) % 4)
  return JSON.parse(atob(bin + pad)) as TokenPayload
}

function getBearerToken(req: Request): string | null {
  const h = req.headers.get('Authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m?.[1] ?? null
}

export async function verifySupabaseJwt(req: Request, env: SupabaseAuthEnv): Promise<AuthUser> {
  const token = getBearerToken(req)
  if (!token) throw new Error('Missing Authorization Bearer token')

  const rawSupabaseUrl = String(env.SUPABASE_URL || '').trim()
  if (!rawSupabaseUrl) throw new Error('Missing SUPABASE_URL')
  const supabaseUrl = rawSupabaseUrl.replace(/\/+$/, '')
  const authBase = /\/auth\/v1$/i.test(supabaseUrl) ? supabaseUrl : `${supabaseUrl}/auth/v1`

  const apiKey = String(env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY || '').trim()
  if (!apiKey) throw new Error('Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY')
  const reqId = Math.random().toString(36).slice(2, 10)
  const startedAt = Date.now()
  console.log(`[auth:supabase ${reqId}] request path=/auth/v1/user`)

  const userRes = await fetch(`${authBase}/user`, {
    method: 'GET',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
    },
    cf: { cacheTtl: 0, cacheEverything: false } as CfFetchOptions,
  })
  console.log(
    `[auth:supabase ${reqId}] response status=${userRes.status} ok=${userRes.ok} ` +
    `latency_ms=${Date.now() - startedAt}`
  )

  if (!userRes.ok) {
    const detail = await userRes.text().catch(() => '')
    console.error(`[auth:supabase ${reqId}] error body=${detail.slice(0, 300)}`)
    throw new Error(`Supabase auth rejected token: ${userRes.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`)
  }

  const user = await userRes.json() as { id?: string; email?: string }
  if (!user?.id) throw new Error('Supabase auth returned invalid user payload')
  console.log(`[auth:supabase ${reqId}] parsed hasUserId=${Boolean(user.id)}`)

  // Optional strict checks from token payload if provided in env.
  try {
    const [, payloadPart] = token.split('.')
    if (payloadPart) {
      const payload = decodeB64urlJson(payloadPart)
      if (env.SUPABASE_JWT_ISS && payload.iss !== env.SUPABASE_JWT_ISS) throw new Error('JWT issuer mismatch')
      if (env.SUPABASE_JWT_AUD && payload.aud !== env.SUPABASE_JWT_AUD) throw new Error('JWT audience mismatch')
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) throw new Error('JWT expired')
    }
  } catch (e) {
    if (e instanceof Error) throw e
  }

  return { userId: String(user.id), email: user.email }
}
