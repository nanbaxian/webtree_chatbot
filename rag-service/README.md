# External RAG Service

This folder is a standalone skeleton for the external retrieval service that
feeds KnowledgeOS chat.

## Responsibilities

- Store the RAG corpus outside Cloudflare D1
- Ingest documents and Q&A pairs
- Create embeddings and chunk records
- Answer `POST /search` with top-k chunks and citations

## Expected API

- `GET /health`
- `POST /search`
- `POST /ingest/document`
- `POST /ingest/qa`

## Runtime contract

- `tenant_id` scopes every request
- `bot_id` narrows retrieval to a bot-specific corpus
- `query` is the natural-language question from `/api/chat`
- `top_k` controls how many chunks to return

## Deployment idea

Use this as a small Cloudflare Worker, FastAPI service, or Node service.
The current repo keeps it separate so the application metadata layer can stay on D1
while the knowledge corpus lives in an external cloud database.
