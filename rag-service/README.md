# External RAG Service

This directory contains the runnable retrieval API for KnowledgeOS.
It connects directly to your PostgreSQL database in BaoTa / Hostinger and serves
the `/search` and ingestion endpoints consumed by `/api/chat`.

## What it does

- stores the RAG corpus outside Cloudflare D1
- ingests documents and Q&A pairs into PostgreSQL
- chunks raw text into retrievable passages
- returns top-k retrieval hits for chat orchestration

## Runtime contract

- `tenant_id` scopes every request
- `bot_id` optionally narrows retrieval to a bot-specific corpus
- `query` is the natural-language question from `/api/chat`
- `top_k` controls how many chunks are returned

## Endpoints

- `GET /health`
- `POST /search`
- `POST /ingest/document`
- `POST /ingest/qa`

## Setup

```bash
cd rag-service
npm install
DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/webtree_rag" npm start
```

If you want a reusable config file, copy `.env.example` to `.env` and fill in
`DATABASE_URL`.

Optional environment variables:

- `HOST` default `127.0.0.1` so the service does not expose a public port
- `PORT` default `8789`
- `RAG_API_KEY` if you want to protect the API with a bearer token
- `PGPOOL_MAX` to tune PostgreSQL pool size
- `DATABASE_CONNECT_TIMEOUT_MS` to reduce how long startup waits for PostgreSQL
- `PGSSLMODE=disable` if you are connecting to a local non-SSL database
- `RAG_MOCK=true` to run without a database
- `RAG_AUTO_INIT_SCHEMA=true` to bootstrap `schema-knowledgeos.sql` on startup when tables are missing

If you are using Cloudflare Tunnel, copy
[`cloudflared.config.yml.example`](./cloudflared.config.yml.example) to
`~/.cloudflared/config.yml`, then run the tunnel against `http://127.0.0.1:8789`.

For a long-running server install, see:

- [`knowledgeos-rag.service.example`](./knowledgeos-rag.service.example)
- [`cloudflared-knowledgeos-rag.service.example`](./cloudflared-knowledgeos-rag.service.example)
- [`deploy-private.md`](./deploy-private.md)

## Example connection strings

- Local PostgreSQL on the same server:
  - `postgresql://webtree_rag:your_password@127.0.0.1:5432/webtree_rag`
- Remote PostgreSQL on your cloud server:
  - `postgresql://webtree_rag:your_password@203.0.113.10:5432/webtree_rag`

For a local shell session on Ubuntu:

```bash
export DATABASE_URL="postgresql://webtree_rag:your_password@203.0.113.10:5432/webtree_rag"
export HOST=127.0.0.1
export PORT=8789
export RAG_API_KEY="your-rag-token"
npm start
```

## Quick QA seed example

You can load sample Q&A pairs with:

```bash
curl -X POST https://rag.webtreeedu.com/ingest/qa \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-rag-token" \
  --data-binary @examples/ingest-qa.example.json
```

If you are running locally, point the URL at `http://127.0.0.1:8789/ingest/qa`.

## Ingest the curated QA seed

The curated QA seed from `originaldata/processed/qa_seed.json` can be ingested with:

```bash
cd rag-service
npm run ingest:qa-seed:dry
npm run ingest:qa-seed
```

To ingest the newer site-archive QA additions without replaying the full seed:

```bash
cd rag-service
npm run ingest:qa-delta:dry
npm run ingest:qa-delta
```

To ingest the people/faculty QA top-up:

```bash
cd rag-service
npm run ingest:qa-delta2:dry
npm run ingest:qa-delta2
```

To ingest the teacher-profile QA top-up:

```bash
cd rag-service
npm run ingest:qa-delta3:dry
npm run ingest:qa-delta3
```

To ingest the schedule / after-school QA top-up:

```bash
cd rag-service
npm run ingest:qa-delta4:dry
npm run ingest:qa-delta4
```

If you want more natural language aliases for the same schedule facts:

```bash
cd rag-service
npm run ingest:qa-delta5:dry
npm run ingest:qa-delta5
```

To ingest more timetable and club coverage:

```bash
cd rag-service
npm run ingest:qa-delta6:dry
npm run ingest:qa-delta6
```

## Ingest the processed source corpus

The raw source files under `originaldata/processed/` can be ingested with:

```bash
cd rag-service
npm run ingest:originaldata:dry
```

To write the processed Markdown into the RAG store:

```bash
cd rag-service
npm run ingest:originaldata
```

The ingestion script reads `originaldata/processed/ingestion_manifest.json`,
skips excluded sources such as screenshots, and posts one document per processed
source file to `/ingest/document`.

By default it uses document-only ingestion for compatibility with the currently
deployed RAG service. If the RAG server has the newer source upsert logic, you
can add `--with-source-metadata` to populate `data_sources` as well.

## Schema bootstrap

The service will automatically apply [`../schema-knowledgeos.sql`](../schema-knowledgeos.sql)
on startup when it detects missing core tables. This keeps the long-term RAG
PostgreSQL self-healing if the schema has not been initialized yet.

If PostgreSQL is temporarily unreachable, the service still starts and reports
the error in `GET /health` instead of exiting. That makes Cloudflare Tunnel
failures show up as backend health issues instead of immediate 502s.

## Notes

- Search currently uses PostgreSQL full-text + substring matching with normalized
  query variants and OR-based fallback so it works now on both exact and looser
  natural-language questions.
- The `vector` extension is installed and ready for embeddings later.
- The schema no longer depends on `pgcrypto`; IDs are generated in the application layer.
- The service auto-seeds `tenant_demo` and `bot_demo` so the default smoke tests and sample
  ingestion requests work immediately after bootstrap.
- When you add embeddings, you can extend the search SQL without changing the API contract.
- The chat API returns top citations in `X-KnowledgeOS-Citations` and stores them in `message_citations` for auditability.
