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
