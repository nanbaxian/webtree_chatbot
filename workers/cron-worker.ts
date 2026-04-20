// workers/cron-worker.ts
// Standalone Cloudflare Worker for Cron Trigger.
// Deploy with: wrangler deploy --config workers/wrangler-cron.toml

import { compressMemories } from '../lib/memory-engine'

interface Env {
  OPENAI_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  AI: Ai
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    console.log('[cron] Starting memory compression...')
    try {
      await compressMemories(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        env.OPENAI_API_KEY,
        env.AI,
      )
      console.log('[cron] Done.')
    } catch (err) {
      console.error('[cron] Failed:', err)
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 })
    }
    try {
      await compressMemories(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, env.OPENAI_API_KEY, env.AI)
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
}
