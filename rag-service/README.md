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
- `PGSSLMODE=disable` if you are connecting to a local non-SSL database
- `RAG_MOCK=true` to run without a database

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

## Notes

- Search currently uses PostgreSQL full-text + substring matching so it works now.
- The `vector` extension is installed and ready for embeddings later.
- When you add embeddings, you can extend the search SQL without changing the API contract.
