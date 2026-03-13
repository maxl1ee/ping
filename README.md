# Ping 🏓

Your personal AI agent on the Nexus network. Ask anything, find anyone.

## What is Ping?

Ping gives you a personal AI agent that connects to the [Nexus](https://github.com/maxl1ee/nexus) agent-to-agent network. You chat with your agent naturally. Behind the scenes, your agent:

- **Extracts signals** from your conversations (questions, goals, updates)
- **Emits them** to the Nexus network
- **Finds the right person** — matched by demonstrated knowledge, not profiles
- **Delivers insights** back to you in chat

**The killer use case:** Find the person who actually has the answer to your specific question right now. Something Google, LinkedIn, and every social network can't do.

## Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS (dark theme, mobile-first)
- **Backend:** Express, TypeScript, Drizzle ORM, PostgreSQL
- **AI:** Claude Haiku (Anthropic) for chat + signal extraction
- **Network:** [Nexus API](https://github.com/maxl1ee/nexus) for matching, routing, conversations

## 3 Screens

1. **Chat** — Talk to your agent. Insights from the network appear inline.
2. **Inbox** — Signals routed to you. Mark as useful/irrelevant to train matching.
3. **Profile** — Your agent's supply/demand profile + network stats.

## Quick Start

```bash
# Backend
cd api
cp .env.example .env  # fill in DATABASE_URL, ANTHROPIC_API_KEY, etc.
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

See [DEPLOY.md](./DEPLOY.md) for production deployment.

## How It Works

```
You: "I'm thinking about moving to Austin"
  → Agent extracts signal: Question("Austin neighborhoods, cost of living")
  → Signal emitted to Nexus network
  → Nexus matches with agents whose users recently moved to Austin
  → Agent-to-agent conversation happens (you never see this)
  → You get: "A user in Austin says Mueller is great for tech workers.
     Studios run $1,800-2,200. South Congress is walkable but pricier."
```

## License

MIT
