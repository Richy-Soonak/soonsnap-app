# SoonSnap App

**Website-to-Video SaaS** — Capture any URL as a cinematic short video, powered by HyperFrames + NVIDIA AI.

> This is the **SoonSnap application** (SaaS product). For the marketing landing page, see [Richy-Soonak/soonsnap](https://github.com/Richy-Soonak/soonsnap).

---

## What is SoonSnap?

SoonSnap lets users paste any website URL and receive a beautifully rendered, cinematic short video of that page. It uses headless browser capture, the HyperFrames render engine, and NVIDIA AI enhancement to transform static web pages into scroll-worthy video content — perfect for social media, product demos, and marketing.

SoonSnap is a **$SOONAK** ecosystem product. Holding 200+ $SOONAK tokens unlocks the Holder tier with premium features.

---

## Pricing Tiers

### 🆓 Free
- Ad-supported experience
- Watermarked videos
- 2 videos per day
- 3 edits per video
- Standard resolution

### 🪙 Holder (Token-Gated)
- **Requires:** 200+ $SOONAK tokens in a Solana wallet
- **No ads, no watermark**
- 2 videos per day
- 5 edits per video
- HD resolution
- Solana wallet connection required

### ⚡ Pro (Paid)
- Credit-based system (Stripe payments)
- **Unlimited** videos
- **Unlimited** edits
- Highest resolution
- Priority rendering queue
- No ads, no watermark

---

## $SOONAK Token

| Field | Value |
|-------|-------|
| **Network** | Solana |
| **Contract** | `H218TQViAXsSqwCLnf7L41zewUTRmdN1r4neLtjBXYXS` |
| **Holder Threshold** | 200+ tokens |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 + TypeScript + Tailwind CSS |
| **Backend** | Supabase (Auth, Database, Storage) |
| **Render Engine** | HyperFrames (frame capture + compositing) |
| **AI Enhancement** | NVIDIA AI (color grading, upscaling, motion) |
| **Job Queue** | Redis + BullMQ |
| **Payments** | Stripe (Subscriptions + Credits) |
| **Wallet** | Solana Web3.js (token-gated access) |
| **Storage** | Cloudflare R2 (video assets + CDN) |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Redirects to /dashboard
│   ├── globals.css             # Global styles (Tailwind)
│   ├── (auth)/
│   │   ├── login/page.tsx      # Sign in page
│   │   └── signup/page.tsx     # Registration page
│   ├── (app)/
│   │   ├── dashboard/page.tsx  # User dashboard (video list)
│   │   └── editor/page.tsx     # Video capture & editor
│   └── api/
│       ├── capture/route.ts    # URL capture endpoint
│       ├── render/route.ts     # Render job endpoint
│       ├── wallet/verify/      # Solana wallet + token verification
│       │   └── route.ts
│       └── enhance/route.ts    # NVIDIA AI enhancement
├── components/                 # Shared UI components
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── solana.ts               # Solana/Web3 helpers ($SOONAK verification)
│   └── stripe.ts               # Stripe payment helpers
└── types/
    └── index.ts                # Tier enum, Video, Render, User types
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Supabase project
- A Solana RPC endpoint
- A Stripe account
- Redis instance (for BullMQ)
- Cloudflare R2 bucket
- NVIDIA API access

### Installation

```bash
git clone https://github.com/Richy-Soonak/soonsnap-app.git
cd soonsnap-app
npm install
```

### Environment Setup

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

See [Required Environment Variables](#required-environment-variables) below.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm start
```

---

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous (public) key |
| `SOLANA_RPC_URL` | Solana JSON RPC endpoint |
| `SOONAK_MINT` | $SOONAK SPL token mint address |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NVIDIA_API_KEY` | NVIDIA AI API key |
| `REDIS_URL` | Redis connection string (for BullMQ) |
| `R2_ACCESS_KEY` | Cloudflare R2 access key ID |
| `R2_SECRET_KEY` | Cloudflare R2 secret access key |
| `R2_BUCKET` | Cloudflare R2 bucket name |
| `R2_ENDPOINT` | Cloudflare R2 endpoint URL |
| `JWT_SECRET` | Secret for signing JWT auth tokens |

---

## Documentation

- 📄 [Full Product Spec](https://docs.google.com/document/d/1uBSRqaIJrmbFoeCvKQeT87h-cqDflGyPNERHQeFi9-4/edit)
- 🌐 [Landing Page Repo](https://github.com/Richy-Soonak/soonsnap)

---

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Commit your changes**: `git commit -m "Add your feature"`
4. **Push to your fork**: `git push origin feature/your-feature-name`
5. **Open a Pull Request** against the `main` branch

Please ensure:
- Code is TypeScript-strict
- Components follow existing file structure
- API routes have proper error handling
- No secrets or `.env` files are committed

---

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

**Built with 💜 by the SoonSnap team — a [$SOONAK](https://solscan.io/token/H218TQViAXsSqwCLnf7L41zewUTRmdN1r4neLtjBXYXS) product.**
