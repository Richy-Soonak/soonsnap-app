# SoonSnap App

**Website-to-Video SaaS** — Paste any URL, get a cinematic short video. Powered by HyperFrames + NVIDIA AI.

> This is the **SoonSnap application** (SaaS product). For the marketing landing page, see [Richy-Soonak/soonsnap](https://github.com/Richy-Soonak/soonsnap).

---

## What is SoonSnap?

SoonSnap lets users paste any website URL and receive a beautifully rendered, cinematic short video of that page. It uses headless browser capture, the HyperFrames render engine, and NVIDIA AI enhancement to transform static web pages into scroll-worthy video content — perfect for social media, product demos, and marketing.

SoonSnap is a **$SOONAK** ecosystem product. Holding 200+ $SOONAK tokens unlocks the Holder tier with premium features.

---

## Features

- **URL to Video** — Paste any URL, pick a style and duration, get an MP4
- **4 Video Styles** — Cinematic, Social Ad, Tutorial, Minimal
- **AI Prompt Enhancement** — Describe what you want, NVIDIA AI enhances it
- **Version History** — Compare side-by-side, re-render with different settings
- **Tier System** — Free, Holder (token-gated), Pro (subscription)
- **Stripe Payments** — Credit packs + Pro subscription
- **Solana Wallet** — Connect wallet, verify $SOONAK balance for Holder tier
- **Watermarked Downloads** — Free tier gets watermark, paid tiers get clean MP4
- **Settings** — Profile, password change, subscription management

---

## Pricing Tiers

### 🆓 Free
- 2 videos per day
- 15s max duration
- Cinematic + Minimal styles
- Watermarked downloads

### 🪙 Holder (Token-Gated)
- **Requires:** 200+ $SOONAK tokens in a Solana wallet
- 10 videos per day
- 30s max duration
- All styles
- No watermark

### ⚡ Pro (Paid)
- Unlimited videos
- 60s max duration
- All styles
- No watermark
- Priority rendering

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 + TypeScript + Tailwind CSS |
| **Auth + Database** | Supabase (self-hosted or cloud) |
| **Render Engine** | HyperFrames CLI |
| **AI Enhancement** | NVIDIA NIM API |
| **Payments** | Stripe (Subscriptions + Credit Packs) |
| **Wallet** | Solana Web3.js + Helius RPC |
| **Video Processing** | ffmpeg (watermark overlay) |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout + toast provider
│   ├── globals.css                   # Tailwind + custom theme
│   ├── (auth)/
│   │   ├── login/page.tsx            # Sign in
│   │   └── signup/page.tsx           # Registration
│   ├── (app)/
│   │   ├── layout.tsx                # Sidebar + mobile nav
│   │   ├── dashboard/page.tsx        # Dashboard with stats
│   │   ├── editor/page.tsx           # URL → video pipeline
│   │   ├── project/[id]/page.tsx     # Version history + re-render
│   │   ├── videos/page.tsx           # All videos list
│   │   ├── credits/page.tsx          # Credit packs + Pro sub
│   │   ├── wallet/page.tsx           # Solana wallet connect
│   │   └── settings/page.tsx         # Profile, password, subscription
│   └── api/
│       ├── capture/route.ts          # HyperFrames URL capture
│       ├── compose/route.ts          # NVIDIA AI composition
│       ├── render/route.ts           # Render job enqueue
│       ├── download/[id]/route.ts    # MP4 download (watermark logic)
│       ├── video/[id]/route.ts       # Video file serving
│       ├── thumbnail/[id]/route.ts   # Thumbnail serving
│       ├── enhance/route.ts          # AI prompt enhancement
│       ├── wallet/
│       │   ├── connect/route.ts      # Connect Solana wallet
│       │   ├── status/route.ts       # Wallet + tier status
│       │   └── disconnect/route.ts   # Disconnect wallet
│       ├── stripe/
│       │   ├── checkout/route.ts     # Create checkout session
│       │   ├── portal/route.ts       # Billing portal redirect
│       │   └── webhook/route.ts      # Stripe webhook handler
│       └── user/delete/route.ts      # Account deletion
├── components/
│   ├── Toast.tsx                     # Toast notification system
│   ├── ToastProvider.tsx             # Toast context wrapper
│   ├── LoadingSpinner.tsx            # Reusable spinner
│   └── ErrorBoundary.tsx             # React error boundary
├── lib/
│   ├── supabase.ts                   # Supabase client + cookie storage
│   ├── supabase-admin.ts             # Server-side admin client
│   ├── auth-helpers.ts               # Auth header utilities
│   ├── stripe-helpers.ts             # Stripe price ID helpers
│   ├── solana.ts                     # Solana + $SOONAK helpers
│   └── tiers.ts                      # Tier limit definitions
└── types/
    └── index.ts                      # TypeScript interfaces
```

---

## Deployment on Vercel

### 1. Clone & Install

```bash
git clone https://github.com/Richy-Soonak/soonsnap-app.git
cd soonsnap-app
npm install
```

### 2. Set Up Supabase

You need a Supabase project (self-hosted or cloud). Create these tables:

**`soonsnap_projects`**
- `id` uuid (PK, default gen_random_uuid)
- `user_id` uuid (FK → auth.users)
- `url` text
- `title` text
- `status` text (default 'pending')
- `created_at`, `updated_at` timestamptz

**`soonsnap_versions`**
- `id` uuid (PK)
- `project_id` uuid (FK → soonsnap_projects)
- `version_num` integer
- `prompt` text
- `enhanced_prompt` text
- `video_url` text
- `thumbnail_url` text
- `duration` integer
- `status` text
- `created_at` timestamptz

**`soonsnap_wallets`**
- `id` uuid (PK)
- `user_id` uuid (FK → auth.users)
- `wallet_address` text (unique)
- `tier` text (default 'free')
- `verified_at`, `created_at`, `updated_at` timestamptz

**`soonsnap_credits`**
- `id` uuid (PK)
- `user_id` uuid (unique, FK → auth.users)
- `balance` integer (default 0)
- `total_purchased` integer (default 0)
- `total_used` integer (default 0)
- `updated_at` timestamptz

**`soonsnap_stripe_customers`**
- `id` uuid (PK)
- `user_id` uuid (FK → auth.users)
- `stripe_customer_id` text
- `subscription_id` text
- `subscription_status` text
- `created_at`, `updated_at` timestamptz

### 3. Set Up Stripe

1. Create a [Stripe](https://stripe.com) account
2. Create 3 products in Stripe:
   - **SoonSnap Pro** — Recurring subscription ($9.99/month)
   - **10 Credit Pack** — One-time ($4.99)
   - **50 Credit Pack** — One-time ($19.99)
3. Note the price IDs (`price_...`) for each
4. Set up a webhook endpoint pointing to `https://your-domain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### 4. Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables, add all variables from `.env.example`:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=         # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon/public key
SUPABASE_SERVICE_KEY=             # Supabase service role key
STRIPE_SECRET_KEY=                # Stripe secret key (sk_live_...)
STRIPE_WEBHOOK_SECRET=            # Stripe webhook signing secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= # Stripe publishable key (pk_live_...)
STRIPE_PRO_PRICE_ID=              # Pro subscription price ID
STRIPE_CREDITS_10_PRICE_ID=       # 10-credit pack price ID
STRIPE_CREDITS_50_PRICE_ID=       # 50-credit pack price ID
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=  # Same as STRIPE_PRO_PRICE_ID
NEXT_PUBLIC_STRIPE_CREDITS_10_PRICE_ID= # Same as above
NEXT_PUBLIC_STRIPE_CREDITS_50_PRICE_ID= # Same as above
NVIDIA_API_KEY=                   # NVIDIA NIM API key
HELIUS_RPC_URL=                   # Helius Solana RPC URL

# Optional
NEXT_PUBLIC_APP_URL=              # Your production URL (for Stripe redirects)
```

### 5. Deploy

```bash
# Option A: Vercel CLI
npx vercel --prod

# Option B: Connect GitHub repo in Vercel dashboard
# → Import project → auto-deploys on push to main
```

### 6. DNS

Point your domain (e.g. `soonsnap.richysoonak.com`) to Vercel:
- Add a CNAME record: `soonsnap → cname.vercel-dns.com`
- Or configure in Vercel dashboard → Settings → Domains

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Fill in your credentials

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Required Tools (Server-Side)

These CLI tools must be available on the deployment server (not needed on Vercel if using external workers):

- **HyperFrames CLI** (`hyperframes`) — URL capture and rendering
- **ffmpeg** — Video processing and watermark overlay
- **Node.js 18+**

> **Note:** On Vercel, long-running capture/render operations require external job workers. The API routes handle job enqueueing; a separate worker process executes the pipeline.

---

## $SOONAK Token

| Field | Value |
|-------|-------|
| **Network** | Solana |
| **Contract** | `H218TQViAXsSqwCLnf7L41zewUTRmdN1r4neLtjBXYXS` |
| **Holder Threshold** | 200+ tokens |

---

## Contributing

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
