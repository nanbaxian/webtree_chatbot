// lib/voice-quota.ts
// Daily voice quota tracking in Cloudflare KV, keyed by userId.

export const FREE_DAILY_SECONDS = 10 * 60

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export function quotaKey(userId: string): string {
  return `voice:${userId}:${todayUTC()}`
}

export async function getUsedSeconds(kv: KVNamespace, key: string): Promise<number> {
  const raw = await kv.get(key)
  const used = raw ? Number(raw) : 0
  return Number.isFinite(used) && used >= 0 ? used : 0
}

export async function addUsedSeconds(kv: KVNamespace, key: string, deltaSeconds: number): Promise<{ used: number; remaining: number }> {
  const used0 = await getUsedSeconds(kv, key)
  const used = Math.max(0, used0 + Math.max(0, Math.floor(deltaSeconds)))
  await kv.put(key, String(used), { expirationTtl: 60 * 60 * 30 })
  const remaining = Math.max(0, FREE_DAILY_SECONDS - used)
  return { used, remaining }
}
