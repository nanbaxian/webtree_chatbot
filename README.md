# P2 文件放置指南

## 新增文件

| 交付文件 | 放置路径 | 说明 |
|---------|---------|------|
| `MemoryManager.tsx` | `components/MemoryManager.tsx` | 记忆可视化管理弹窗 |
| `PersonaSwitcher.tsx` | `components/PersonaSwitcher.tsx` | 多人设切换面板 |
| `cf-personas.ts` | `functions/api/personas.ts` | 人设列表 CRUD |
| `cf-personas-active.ts` | `functions/api/personas/active.ts` | 活跃人设读写 |
| `cf-memory-core.ts` | `functions/api/memory/core.ts` | 核心记忆管理 |
| `cf-memory-snapshots.ts` | `functions/api/memory/snapshots.ts` | 快照管理 |

## 更新文件（覆盖替换）

| 交付文件 | 放置路径 | 改动 |
|---------|---------|------|
| `page.tsx` | `app/page.tsx` | 接入三个弹窗，切换人设清空消息 |
| `Sidebar.tsx` | `components/Sidebar.tsx` | 新增三个操作按钮 |
| `memory-engine.ts` | `lib/memory-engine.ts` | 向量嵌入生成 + 语义搜索 |
| `context-builder.ts` | `lib/context-builder.ts` | 语义匹配记忆注入 |

## 数据库补丁

在 Supabase SQL Editor 执行 `schema-p1.sql`（如果 P1 时没执行）

> ⚠️ 本版本已将向量维度升级为 1024（Cloudflare Workers AI `@cf/baai/bge-m3`）。
> 如果你之前已写入 768 维 embedding，请先将旧值置空再升级：
>
> ```sql
> UPDATE memory_snapshots SET embedding = NULL;
> ```

```sql
-- 确认 personas 表支持多条记录（P0 schema 已经支持，无需改动）
-- 确认 app_settings 表有 active_persona_id（P0 schema 已有）
```

## 新增目录

```bash
mkdir -p functions/api/personas
mkdir -p functions/api/memory
```

## P2 完成检查清单

- [ ] 侧边栏有三个按钮：人设 / 记忆 / 切换
- [ ] 记忆管理弹窗能看到核心记忆和快照，能单条删除
- [ ] 手动触发压缩按钮有响应
- [ ] 人设切换面板能看到所有人设，点击切换后聊天记录清空
- [ ] 预设人设模板能一键创建
- [ ] 创建新人设能正常保存并切换
- [ ] 向量搜索：压缩记忆后，新对话的 System Prompt 里出现"和这个话题相关的记忆"

## 语音成本分层（Free/Pro）

- Free：Deepgram ASR + Google TTS，默认每日 10 分钟（按 **Supabase user_id** 计）
- Pro ：Deepgram ASR + ElevenLabs TTS

需要在 Cloudflare Pages 里配置：

- 环境变量：
  - `DEEPGRAM_API_KEY`、`GOOGLE_TTS_API_KEY`、`ELEVENLABS_API_KEY`（可选）、`ELEVENLABS_VOICE_ID`（可选）
  - `SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`SUPABASE_JWT_ISS`、`SUPABASE_JWT_AUD`
- KV 绑定：`VOICE_KV`（用于免费用户每日配额）

## 登录（Supabase Magic Link）

Sidebar 底部提供最小登录组件：输入邮箱发送 Magic Link。

客户端（Next.js）需要配置：

- `.env.local`：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`

服务端（Cloudflare Pages Functions）需要配置：

- `SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`SUPABASE_JWT_ISS`（通常 `${SUPABASE_URL}/auth/v1`）、`SUPABASE_JWT_AUD`（通常 `authenticated`）
- 若 `/auth/v1/certs` 返回 401，可额外配置 `SUPABASE_ANON_KEY`（后端验签拉 JWKS 时会优先使用该 key）
- `GEMINI_API_KEY`（图片分析专用，`/api/chat` 有图时走 `gemini-2.5-flash-lite`）
- 可选：`GEMINI_VISION_MODEL`（默认 `gemini-2.5-flash-lite`）

> `/api/voice` 已强制要求登录：请求必须带 `Authorization: Bearer <access_token>`。

## 全项目完成！

P0 ✅ 文字对话 + 流式输出 + 人设设定 + 短期记忆
P1 ✅ 语音输入输出 + 图片识别 + 记忆压缩 Cron
P2 ✅ 向量语义搜索 + 记忆管理页面 + 多人设切换


## R2 (New)
- Bind an R2 bucket as `BUCKET`
- Upload endpoint: POST /api/upload (multipart field: file)
- Public read: GET /r2/:key
