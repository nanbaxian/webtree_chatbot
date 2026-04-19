# Private Deployment

Use this when you want the RAG API to stay private behind Cloudflare Tunnel.

## 1. Install dependencies

```bash
cd /opt/knowledgeos/rag-service
npm install
```

## 2. Configure the service

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL`
- `HOST=127.0.0.1`
- `PORT=8789`
- `RAG_API_KEY` if you want API auth

## 3. Create the tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create knowledgeos-rag
cloudflared tunnel route dns knowledgeos-rag rag.your-domain.com
```

## 4. Install tunnel config

Copy `cloudflared.config.yml.example` to `~/.cloudflared/config.yml` and replace the
placeholders with the real tunnel UUID.

## 5. Enable the tunnel

```bash
systemctl enable knowledgeos-rag
systemctl start knowledgeos-rag
systemctl enable cloudflared-knowledgeos-rag
systemctl start cloudflared-knowledgeos-rag
```

## 6. Verify

```bash
curl http://127.0.0.1:8789/health
curl https://rag.your-domain.com/health
```
