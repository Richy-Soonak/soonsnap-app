<div align="center">

# ⚡ SoonSnap

**Website-to-Video SaaS — Paste any URL, get a cinematic animated MP4**

[![Version](https://img.shields.io/badge/version-v0.3.0-7f900?style=flat-square&labelColor=111111&color=e7f900)](https://github.com/Richy-Soonak/soonsnap-app)
[![Status](https://img.shields.io/badge/status-live-brightgreen?style=flat-square&labelColor=111111)](https://github.com/Richy-Soonak/soonsnap-app)
[![License](https://img.shields.io/badge/license-MIT-111111?style=flat-square&labelColor=111111&color=ffffff)](./LICENSE)

</div>

---

## What it does

SoonSnap turns any website into a short, animated promotional video. Enter a URL, pick a style and duration, and the pipeline captures the site's design tokens (colors, fonts, layout), uses AI to compose a GSAP-animated HTML composition, and renders it to an MP4.

**Live at [soonsnap.richysoonak.com](https://soonsnap.richysoonak.com)**

## Pipeline

```
URL → Capture (HyperFrames) → AI Compose (Owl Alpha) → Render (HyperFrames CLI) → MP4
```

| Stage | Tool | What happens |
|-------|------|-------------|
| **Capture** | HyperFrames CLI | Takes scroll screenshots, extracts colors, fonts, text, animations |
| **Compose** | Owl Alpha (via OpenRouter) | Generates a self-contained GSAP-animated HTML file using the captured tokens |
| **Render** | HyperFrames CLI | Renders the HTML composition to a 1920×1080 MP4 |
| **Thumbnail** | ffmpeg | Extracts a poster frame at the 1-second mark |

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Next.js App    │     │   Supabase       │     │  Docker Agent    │
│   (Vercel)       │────▶│   (Self-hosted)  │     │  (Port 3200)     │
│                  │     │                  │     │                  │
│ • Editor UI      │     │ • Auth           │     │ • Owl Alpha LLM  │
│ • API routes     │     │ • Projects DB    │     │ • Compose HTML   │
│ • Stripe billing │     │ • Job queue      │     │ • Render MP4     │
│ • Credit system  │     │ • Credits        │     │ • Thumbnail      │
└──────────────────┘     │ • File storage   │     └──────────────────┘
                         └──────────────────┘
```

### Key components

- **Frontend**: Next.js 14+ app with App Router, deployed on Vercel. Tailwind CSS + Lucide icons.
- **API layer**: Next.js API routes for render jobs, credits, Stripe webhooks, and file serving.
- **Worker**: `render-worker.ts` polls the Supabase job queue, orchestrates capture→compose→render pipeline.
- **Agent**: Docker container ([soonsnap-agent](https://github.com/Lisa-KimDev/soonsnap-agent)) running the AI compose + render stages via Owl Alpha on OpenRouter.
- **Database**: Self-hosted Supabase (PostgreSQL) with tables for projects, versions, jobs, credits, wallets, and Stripe customers.

## Features

### Video styles
- **Cinematic** — Dramatic reveals, smooth camera moves
- **Social Ad** — Punchy, fast cuts, bold text
- **Tutorial** — Step-by-step, clear annotations
- **Minimal** — Clean, elegant, whitespace-forward

### Credit system
- Users purchase credits via Stripe (10 or 50 packs)
- 1 credit = 1 video generation
- Balance checked at enqueue, deducted on successful completion only
- Tier-based limits (free/holder/pro) with daily render caps and max durations

### Real-time UX
- Polling-based job status with progress bar and step indicators
- Worker-sent status messages for each pipeline stage
- Elapsed timer and estimated remaining time
- Queue indicator when worker is busy

### Billing
- Stripe Checkout for one-time credit purchases
- Webhook handles credit fulfillment
- Subscription support for Pro tier (unlimited renders, 60s duration)

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, React, Tailwind CSS, Lucide |
| Backend | Next.js API Routes, Supabase JS |
| AI/LLM | Owl Alpha via OpenRouter |
| Capture | HyperFrames CLI |
| Render | HyperFrames CLI, ffmpeg |
| Database | PostgreSQL (Supabase self-hosted) |
| Auth | Supabase Auth (email, magic link) |
| Billing | Stripe (Checkout + Webhooks) |
| Blockchain | Solana / Helius (token-gating, planned) |
| Infra | Vercel (app), Docker (agent), Nginx (proxy) |

## Project structure

```
src/
├── app/
│   ├── (app)/           # Authenticated pages (editor, dashboard, videos)
│   ├── (auth)/          # Login, signup
│   └── api/             # API routes
│       ├── capture/     # Website capture
│       ├── render/      # Job enqueue (credit check)
│       ├── jobs/[id]/   # Job status polling
│       ├── credits/     # Balance info
│       ├── stripe/      # Stripe webhooks
│       ├── video/[id]/  # Video file serving
│       └── enhance/     # Prompt enhancement
├── lib/
│   ├── job-queue.ts     # Supabase job queue operations
│   ├── supabase.ts      # Client-side Supabase
│   ├── supabase-admin.ts # Server-side admin client
│   ├── tiers.ts         # Tier limits config
│   └── auth-helpers.ts  # Auth header utilities
├── workers/
│   └── render-worker.ts # Main pipeline worker
└── types/
    └── index.ts         # TypeScript types
```

## Getting started

### Prerequisites
- Node.js 18+
- Supabase instance (self-hosted or cloud)
- OpenRouter API key (for Owl Alpha)
- HyperFrames CLI (`npm install -g hyperframes`)
- Stripe account (for billing)

### Setup

```bash
# Clone
git clone https://github.com/Richy-Soonak/soonsnap-app.git
cd soonsnap-app

# Install
npm install

# Configure
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY,
#          NEXT_PUBLIC_STRIPE_PK, STRIPE_SK, NVIDIA_API_KEY

# Run dev
npm run dev

# Start worker (separate terminal)
npx tsx src/workers/render-worker.ts
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (public) |
| `SUPABASE_URL_INTERNAL` | Supabase URL (internal, for worker) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_STRIPE_PK` | Stripe publishable key |
| `STRIPE_SK` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `SOONSNAP_AGENT_URL` | Docker agent URL (default: `http://localhost:3200`) |

## Database schema

Key tables (prefixed `soonsnap_`):

- **projects** — User projects with URL, style, status
- **versions** — Render versions per project (prompt, video URL, thumbnail)
- **jobs** — Async job queue (status, progress, status_message, result)
- **credits** — User credit balances (balance, total_purchased, total_used)
- **wallets** — User tier info (free/holder/pro)
- **stripe_customers** — Stripe customer mapping

## Agent

The Docker agent handles the heavy AI compose + render work. See [Lisa-KimDev/soonsnap-agent](https://github.com/Lisa-KimDev/soonsnap-agent) for agent code and configuration.

## License

MIT © SOONAK
