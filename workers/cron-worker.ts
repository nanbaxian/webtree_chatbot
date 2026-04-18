// workers/cron-worker.ts
// 独立 Cloudflare Worker，专门处理 Cron Trigger
// 部署命令：wrangler deploy --config workers/wrangler-cron.toml
//
// 为什么需要独立 Worker？
// CF Pages Functions 不支持 Cron Triggers，只有独立 Worker 才支持。
// 这个 Worker 只做一件事：每天凌晨 2 点调用 /api/memory/compress。

import { compressMemories } from '../lib/memory-engine'

interface Env {
  DEEPINFRA_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  AI: Ai  // Workers AI binding — @cf/baai/bge-m3 向量嵌入（1024维）
}

export default {
  // Cron Trigger 入口
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    console.log('[cron] Starting memory compression...')
    try {
      await compressMemories(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_KEY,
        env.DEEPINFRA_API_KEY,
        env.AI,
      )
      console.log('[cron] Done.')
    } catch (err) {
      console.error('[cron] Failed:', err)
    }
  },

  // 也支持 fetch（用于手动测试）
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 })
    }
    try {
      await compressMemories(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, env.DEEPINFRA_API_KEY, env.AI)
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
