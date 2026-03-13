# Ping — Deploy Guide

Two services: backend (Express) and frontend (Next.js).

## Prerequisites

- GitHub repo: `maxl1ee/ping`
- PostgreSQL database (Render free tier or Neon)
- Anthropic API key (for Claude Haiku)
- Nexus API running (see `maxl1ee/nexus`)

---

## 1. Database (PostgreSQL)

### Render (recommended)
1. **Render Dashboard** → New → PostgreSQL
2. Name: `ping-db`
3. Plan: Free (90-day) or Starter ($7/mo)
4. Copy the **Internal Database URL** — you'll need this as `DATABASE_URL`

### Alternative: Neon (free forever)
1. Go to [neon.tech](https://neon.tech)
2. Create a project → copy the connection string

---

## 2. Backend (Express API)

### Deploy on Render

1. **Render Dashboard** → New → Web Service
2. Connect GitHub → select `maxl1ee/ping`
3. Configure:
   - **Name:** `ping-api`
   - **Root Directory:** `api`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free ($0) or Starter ($7/mo)

4. **Environment Variables:**

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `NEXUS_API_URL` | URL of your Nexus API (e.g., `https://nexus-api.onrender.com`) |
| `JWT_SECRET` | Any random string (e.g., `openssl rand -hex 32`) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Your frontend URL (for CORS) |
| `PORT` | `3002` (Render auto-assigns, but set as fallback) |

5. Deploy — migrations run automatically on startup.
6. Test: `curl https://ping-api.onrender.com/health`

---

## 3. Frontend (Next.js)

### Deploy on Vercel (recommended, free)

1. Go to [vercel.com](https://vercel.com) → Import Project
2. Connect GitHub → select `maxl1ee/ping`
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js (auto-detected)

4. **Environment Variables:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your backend URL (e.g., `https://ping-api.onrender.com`) |

5. Deploy.

### Alternative: Render Static Site

1. Render → New → Static Site
2. Root Directory: `frontend`
3. Build Command: `npm install && npm run build`
4. Publish Directory: `.next`
5. Set `NEXT_PUBLIC_API_URL` environment variable

---

## 4. Verify

```bash
# Health check
curl https://ping-api.onrender.com/health

# Register a user
curl -X POST https://ping-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","name":"Test","password":"testtest"}'

# Login
curl -X POST https://ping-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testtest"}'
```

---

## Cost Summary

| Service | Provider | Cost |
|---|---|---|
| Backend | Render Free | $0/mo |
| Database | Render Free / Neon Free | $0/mo |
| Frontend | Vercel Free | $0/mo |
| LLM | Anthropic (Claude Haiku) | ~$0.01/conversation |
| Nexus API | Render Free | $0/mo |
| **Total** | | **~$0/mo** + usage |

### Upgrade path
- Render Starter: $7/mo each (no cold starts)
- Neon Pro: $19/mo (more storage)
- Vercel Pro: $20/mo (more bandwidth)

---

## Architecture

```
User → Ping Frontend (Vercel)
         ↓ HTTP
       Ping Backend (Render)
         ├── Auth (JWT + bcrypt)
         ├── Chat (Claude Haiku)
         ├── Signal Extraction (auto)
         └── Nexus Client
               ↓ HTTP
             Nexus API (Render)
               ├── Agent Registration
               ├── Signal Routing
               ├── A2A Conversations
               └── Reputation Engine
```
