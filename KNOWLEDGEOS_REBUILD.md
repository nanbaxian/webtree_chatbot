# KnowledgeOS Rebuild Notes

This repository is being converted from a personal AI companion into a multi-tenant enterprise knowledge chatbot platform.

## What changed

- Public landing page now uses KnowledgeOS branding and product language.
- Dashboard routes were added for:
  - `/dashboard`
  - `/dashboard/sources`
  - `/dashboard/bots`
  - `/dashboard/conversations`
  - `/dashboard/usage`
  - `/dashboard/members`
  - `/dashboard/embed`
- Auth routes were added for:
  - `/auth/login`
  - `/auth/register`
- Demo chat route was added at `/chat/demo`.
- Cloudflare configuration was renamed and rebuilt for KnowledgeOS.
- New PostgreSQL schema file added at `schema-knowledgeos.sql`.
- KnowledgeOS API scaffolds were added under `functions/api/`.

## Cloudflare resources to recreate

- Pages project name: `webtree-chatbot-front`
- Worker / backend project name: `webtree-chatbot-back`
- R2 bucket: `knowledgeos-assets`
- KV binding: `VOICE_KV`
- AI binding: `AI`
- D1 database for app metadata: `knowledgeos_app`

## Rebuild checklist

Use this order when recreating the Cloudflare side from scratch:

1. Log in to Wrangler:
   - `npx wrangler login`
2. Recreate the Pages project:
   - `npx wrangler pages project create`
   - Project name: `webtree-chatbot-front`
   - Production branch: your default deploy branch
3. Recreate the R2 bucket:
   - `npx wrangler r2 bucket create knowledgeos-assets`
4. Recreate the KV namespace:
   - `npx wrangler kv namespace create VOICE_KV`
5. Recreate the D1 database for app metadata:
   - `npx wrangler d1 create knowledgeos_app`
6. Apply the D1 schema:
   - `npx wrangler d1 execute knowledgeos_app --file=./schema-knowledgeos-d1.sql`
7. Recreate Pages secrets in the Cloudflare dashboard:
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `SUPABASE_JWT_ISS`
   - `SUPABASE_JWT_AUD`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `CRON_SECRET`
   - Optional CLI equivalent:
     - `npx wrangler pages secret put NEXT_PUBLIC_SITE_URL --project-name=webtree-chatbot-front`
     - repeat for the remaining keys
8. Recreate worker-level secrets for the cron worker in Cloudflare Workers:
   - `OPENAI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `CRON_SECRET`
   - Optional CLI equivalent:
     - `npx wrangler secret put OPENAI_API_KEY`
     - repeat for the remaining worker secrets in the `webtree-chatbot-back` project
9. Bind the recreated resources back into `wrangler.toml` and `workers/wrangler-cron.toml` with the real IDs Cloudflare gives you.

## Cloudflare binding map

- Pages app:
  - `webtree-chatbot-front`
- Worker / backend:
  - `webtree-chatbot-back`
- Pages / worker shared storage:
  - `VOICE_KV`
  - `knowledgeos-assets`
- App metadata:
  - `knowledgeos_app` on D1

## Notes on D1 vs RAG storage

- Cloudflare D1 is the application metadata layer.
- Use D1 for tenants, bots, conversations, members, usage, and retrieval audit logs.
- Keep the RAG corpus in the external cloud database later, as planned.
- Apply `schema-knowledgeos.sql` only to that external RAG database, not to D1.

## External RAG contract

The chat orchestration layer expects the retrieval service to expose:

- `GET /health`
- `POST /search`
- `POST /ingest/document`
- `POST /ingest/qa`

`POST /search` should accept:

- `tenant_id`
- `bot_id`
- `query`
- `top_k`
- optional `conversation_id`
- optional `request_id`
- optional `locale`
- optional `filters`

`POST /search` should return:

- `request_id`
- `latency_ms`
- `chunks`
- optional `warnings`

Each chunk should be able to carry:

- `title`
- `section`
- `content`
- `source_url`
- `page_num`
- `score`
- `source_label`
- `source_type`

The repo includes a reusable protocol helper at `lib/rag-protocol.ts` and a runnable PostgreSQL-backed retrieval service in `rag-service/`.

To run the external RAG service on the server:

1. `cd rag-service`
2. `npm install`
3. Set `DATABASE_URL` to your PostgreSQL connection string
4. Run `npm start`

If you want a quick smoke test without the database, set `RAG_MOCK=true` and start the service anyway.

To keep the service private behind Cloudflare:

1. Keep `rag-service` bound to `127.0.0.1`.
2. Run `cloudflared tunnel login` on the server.
3. Create a tunnel, for example `knowledgeos-rag`.
4. Route a hostname such as `rag.your-domain.com` to `http://127.0.0.1:8789`.
5. Protect that hostname with Cloudflare Access or a service token.

The repo includes a tunnel config sample at
`rag-service/cloudflared.config.yml.example`.

For server installs, also see:

- `rag-service/knowledgeos-rag.service.example`
- `rag-service/cloudflared-knowledgeos-rag.service.example`
- `rag-service/deploy-private.md`

Example connection strings:

- Local PostgreSQL on the same server:
  - `postgresql://webtree_rag:your_password@127.0.0.1:5432/webtree_rag`
- Remote PostgreSQL on a cloud server:
  - `postgresql://webtree_rag:your_password@203.0.113.10:5432/webtree_rag`

Main app example:

- `RAG_API_URL=http://127.0.0.1:8789` for local development
- `RAG_API_URL=https://rag.your-domain.com` for production
- `RAG_API_KEY=your-rag-token` if you enabled RAG API authentication

If you use Cloudflare Access service tokens, the app can keep calling the
`RAG_API_URL` hostname while the tunnel blocks direct public access.

## Environment variables

Set these in Cloudflare Pages and local dev as needed:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_JWT_ISS`
- `SUPABASE_JWT_AUD`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CRON_SECRET`

## Database

Apply `schema-knowledgeos-d1.sql` to the Cloudflare D1 database before wiring the Pages Functions.

Apply `schema-knowledgeos.sql` to the external Postgres instance later for RAG chunks and vectors.

If you want the rebuild to stay repeatable, keep the external RAG database separate from the Cloudflare app metadata database.

The schema includes:

- D1 app metadata:
  - tenants
  - users
  - tenant_members
  - bots
  - data_sources
  - documents
  - conversations
  - messages
  - message_citations
  - bot_settings
  - usage_logs
  - retrieval_logs

- external RAG storage:
  - documents
  - document_versions
  - document_chunks
  - qa_pairs
  - conversation_summaries
  - ingestion_jobs
  - crawl_jobs
  - reindex_jobs

## API scaffolds

Current API shells live in:

- `functions/api/tenant.ts`
- `functions/api/bots.ts`
- `functions/api/sources.ts`
- `functions/api/documents.ts`
- `functions/api/conversations.ts`
- `functions/api/members.ts`
- `functions/api/usage.ts`
- `functions/api/retrieval-logs.ts`

These are intentionally scaffolded so the UI and route structure exist before the full database wiring is completed.

## Verification

Validated locally with:

- `npm run build`
- `npx wrangler deploy --dry-run --config workers/wrangler-cron.toml`
