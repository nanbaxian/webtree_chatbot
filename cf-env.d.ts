// cf-env.d.ts
// Cloudflare Pages Functions 全局类型声明
// 让 tsc 知道 PagesFunction / ExportedHandlerScheduledHandler 是什么

interface EventContext<Env, P extends string = string, Data = unknown> {
  request: Request
  env: Env
  params: Record<P, string | string[]>
  data: Data
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>
  waitUntil: (promise: Promise<unknown>) => void
  passThroughOnException: () => void
}

type PagesFunction<
  Env = Record<string, unknown>,
  P extends string = string,
  Data = unknown
> = (context: EventContext<Env, P, Data>) => Response | Promise<Response>

interface ScheduledEvent {
  cron: string
  scheduledTime: number
  type: 'scheduled'
}

interface ExportedHandlerScheduledHandler<Env = Record<string, unknown>> {
  (event: ScheduledEvent, env: Env, ctx: ExecutionContext): void | Promise<void>
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

// Workers AI binding 类型
// 参考：https://developers.cloudflare.com/workers-ai/
interface AiTextEmbeddingsOutput {
  shape: number[]
  data: number[][]
}

interface Ai {
  run(
    model: '@cf/baai/bge-m3',
    inputs: { text: string | string[]; truncate_inputs?: boolean }
  ): Promise<AiTextEmbeddingsOutput>
  // 允许其他模型调用（宽松类型）
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>
}
