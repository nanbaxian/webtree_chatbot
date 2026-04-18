// lib/plan.ts
// Fetch user plan (free/pro) from Supabase using Service Role key.

type UserPlan = 'free' | 'pro'

type PlanEnv = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

class SupabaseRest {
  constructor(private url: string, private key: string) {}

  async get<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const u = new URL(`${this.url}/rest/v1/${path}`)
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v)
    const reqId = Math.random().toString(36).slice(2, 10)
    const startedAt = Date.now()
    console.log(
      `[plan:supabase ${reqId}] request path=${path} query_keys=${Object.keys(query).join(',') || 'none'}`
    )
    const res = await fetch(u.toString(), {
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
      },
    })
    console.log(
      `[plan:supabase ${reqId}] response status=${res.status} ok=${res.ok} latency_ms=${Date.now() - startedAt}`
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[plan:supabase ${reqId}] error body=${detail.slice(0, 300)}`)
      throw new Error(`Supabase REST error: ${res.status}`)
    }
    return res.json() as Promise<T>
  }
}

export async function getUserPlan(env: PlanEnv, userId: string): Promise<UserPlan> {
  try {
    const db = new SupabaseRest(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
    const rows = await db.get<Array<{ plan: string }>>('user_plans', {
      select: 'plan',
      user_id: `eq.${userId}`,
      limit: '1',
    })
    const plan = (rows?.[0]?.plan || 'free').toLowerCase()
    return plan === 'pro' ? 'pro' : 'free'
  } catch {
    // Fail-closed
    return 'free'
  }
}
