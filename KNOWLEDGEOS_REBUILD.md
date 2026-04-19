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

- Pages project name: `knowledgeos-web`
- Cron worker name: `knowledgeos-cron`
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
   - Project name: `knowledgeos-web`
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
   - `DEEPINFRA_API_KEY`
   - `GEMINI_API_KEY`
   - `CRON_SECRET`
   - Optional CLI equivalent:
     - `npx wrangler pages secret put NEXT_PUBLIC_SITE_URL --project-name=knowledgeos-web`
     - repeat for the remaining keys
8. Recreate worker-level secrets for the cron worker in Cloudflare Workers:
   - `DEEPINFRA_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `CRON_SECRET`
   - Optional CLI equivalent:
     - `npx wrangler secret put DEEPINFRA_API_KEY`
     - repeat for the remaining worker secrets in the `knowledgeos-cron` project
9. Bind the recreated resources back into `wrangler.toml` and `workers/wrangler-cron.toml` with the real IDs Cloudflare gives you.

## Cloudflare binding map

- Pages app:
  - `knowledgeos-web`
- Cron worker:
  - `knowledgeos-cron`
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

The repo includes a reusable protocol helper at `lib/rag-protocol.ts` and a separate external-worker skeleton in `rag-service/`.

## Environment variables

Set these in Cloudflare Pages and local dev as needed:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_JWT_ISS`
- `SUPABASE_JWT_AUD`
- `DEEPINFRA_API_KEY`
- `GEMINI_API_KEY`
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
