     1|<div align="center">
     2|
     3|# ⚡ SoonSnap
     4|
     5|**Website-to-Video SaaS — Paste any URL, get a cinematic animated MP4**
     6|
     7|[![Version](https://img.shields.io/badge/version-v0.2.5-7f900?style=flat-square&labelColor=111111&color=e7f900)](https://github.com/Richy-Soonak/soonsnap-app)
     8|[![Status](https://img.shields.io/badge/status-live-brightgreen?style=flat-square&labelColor=111111)](https://github.com/Richy-Soonak/soonsnap-app)
     9|[![License](https://img.shields.io/badge/license-MIT-111111?style=flat-square&labelColor=111111&color=ffffff)](./LICENSE)
    10|
    11|*Codename: **Ryu** · 🥋 Street Fighter Edition*
    12|
    13|</div>
    14|
    15|---
    16|
    17|## Overview
    18|
    19|SoonSnap transforms any website URL into a polished, cinematic animated MP4 — automatically. Paste a link, pick a style, and let the pipeline do the rest: **capture → AI compose → render → play**. No design skills required.
    20|
    21|Built with a dark‑neon, premium sensibility. Designed to move fast and look sharp doing it.
    22|
    23|---
    24|
    25|## Architecture
    26|
    27|```
    28|┌─────────────────────────────────────────────────────────────────────┐
    29|│                        SoonSnap · Ryu                        │
    30|│                                                                     │
    31|│   ┌──────────┐      ┌──────────────┐      ┌───────────────────┐    │
    32|│   │ Browser   │─────▶│  API Routes   │─────▶│  Supabase Job     │    │
    33|│   │ (Vercel)  │◀─────│  (Next.js 14) │◀─────│  Queue            │    │
    34|│   └──────────┘      └──────────────┘      └────────┬──────────┘    │
    35|│                                                      │               │
    36|│                                                      ▼               │
    37|│                                            ┌──────────────────┐     │
    38|│                                            │  Server Worker    │     │
    39|│                                            │  (systemd)        │     │
    40|│                                            │                   │     │
    41|│                                            │  1. Capture (URL) │     │
    42|│                                            │  2. Compose (AI)  │     │
    43|│                                            │  3. Render (ffmpeg)│    │
    44|│                                            └────────┬──────────┘    │
    45|│                                                      │               │
    46|│                                                      ▼               │
    47|│                                            ┌──────────────────┐     │
    48|│                                            │  nginx           │     │
    49|│                                            │  (video serving) │     │
    50|│                                            └──────────────────┘     │
    51|└─────────────────────────────────────────────────────────────────────┘
    52|```
    53|
    54|**Flow:** Browser on Vercel → API routes queue a job in Supabase → systemd worker picks it up, captures screenshots, runs LLM composition, renders with ffmpeg → nginx serves the final MP4 back through the Vercel proxy.
    55|
    56|---
    57|
    58|## Tech Stack
    59|
    60|| Layer | Technology |
    61||-------|-----------|
    62|| **Frontend** | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
    63|| **Database / Auth** | Supabase (self‑hosted) — Postgres, Realtime, Auth |
    64|| **AI / LLM** | NVIDIA NIM · OpenAI‑compatible endpoints · Dynamic model config |
    65|| **Video Engine** | HyperFrames CLI · ffmpeg |
    66|| **Payments** | Stripe *(planned)* |
    67|| **Blockchain** | Solana / Helius *(planned)* |
    68|| **Infrastructure** | Vercel (frontend) · Bare‑metal worker · nginx · systemd |
    69|
    70|---
    71|
    72|## Features · v0.2.5 "Ryu"
    73|
    74|What's **live and working** right now:
    75|
    76|- **Full E2E Pipeline** — Capture → AI Compose → Render → Play, fully automated
    77|- **4 Video Styles** — Cinematic, Social Ad, Tutorial, Minimal
    78|- **Dynamic LLM Config** — Swap AI models from the admin panel without redeploying
    79|- **Per‑Tier Model Support** — Free vs. paid users are routed to different models automatically
    80|- **Credit System** — Database schema live; API + UI in progress
    81|- **Rate Limiting** — Configuration stored in DB; enforcement layer shipping soon
    82|- **Auth** — Supabase email/password with auto‑confirm
    83|- **Video Serving** — nginx on the metal, proxied through Vercel for clean URLs
    84|- **Systemd Worker** — Polls Supabase every 3 seconds, processes jobs sequentially
    85|
    86|---
    87|
    88|## Directory Structure
    89|
    90|```
    91|soonsnap-app/
    92|├── src/
    93|│   ├── app/                # Next.js 14 App Router pages & API routes
    94|│   │   ├── api/            #   REST endpoints (jobs, config, health)
    95|│   │   ├── (auth)/         #   Auth pages (login, signup)
    96|│   │   └── (dashboard)/    #   Main app shell
    97|│   ├── lib/                # Shared utilities, Supabase client, helpers
    98|│   ├── workers/            # Capture, compose, and render pipeline logic
    99|│   └── types/              # TypeScript type definitions
   100|├── public/                 # Static assets
   101|├── supabase/               # Migrations & seed data
   102|├── .env.local              # Environment variables (not committed)
   103|├── next.config.js
   104|├── tailwind.config.ts
   105|├── tsconfig.json
   106|└── package.json
   107|```
   108|
   109|---
   110|
   111|## Getting Started
   112|
   113|### Prerequisites
   114|
   115|- Node.js ≥ 18
   116|- A running Supabase instance (self‑hosted or cloud)
   117|- ffmpeg installed on the worker machine
   118|- HyperFrames CLI available in `$PATH`
   119|- An NVIDIA NIM or OpenAI‑compatible LLM endpoint
   120|
   121|### Install
   122|
   123|```bash
   124|git clone https://github.com/Richy-Soonak/soonsnap-app.git
   125|cd soonsnap-app
   126|npm install
   127|```
   128|
   129|### Environment Variables
   130|
   131|Copy the template and fill in your values:
   132|
   133|```bash
   134|cp .env.local.example .env.local
   135|```
   136|
   137|**`.env.local` template:**
   138|
   139|```env
   140|# ─── Supabase ───────────────────────────────────
   141|NEXT_PUBLIC_SUPABASE_URL=https://your-supabase.example.com
   142|NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   143|SUPABASE_SERVICE_ROLE_KEY=eyJ...
   144|
   145|# ─── LLM / AI ───────────────────────────────────
   146|NIM_API_KEY=nvapi-...
   147|OPENAI_API_KEY=sk-...
   148|OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1    # or your endpoint
   149|
   150|# ─── Worker ──────────────────────────────────────
   151|WORKER_POLL_INTERVAL_MS=3000
   152|HYPERFRAMES_CLI_PATH=/usr/local/bin/hyperframes
   153|FFMPEG_PATH=/usr/bin/ffmpeg
   154|
   155|# ─── Video Storage / Serving ─────────────────────
   156|VIDEO_OUTPUT_DIR=/var/www/soonsnap/videos
   157|VIDEO_BASE_URL=https://your-domain.com/videos
   158|
   159|# ─── App Config ──────────────────────────────────
   160|NEXT_PUBLIC_APP_URL=http://localhost:3000
   161|NODE_ENV=development
   162|```
   163|
   164|### Run (Development)
   165|
   166|```bash
   167|npm run dev              # Next.js frontend on :3000
   168|npm run worker           # Start the job worker locally
   169|```
   170|
   171|---
   172|
   173|## Database Schema
   174|
   175|All tables live in the `public` schema of your Supabase Postgres instance.
   176|
   177|### `app_config`
   178|Dynamic application settings — LLM model names, rate limits, feature flags. Read by the worker at runtime; no redeploy needed.
   179|
   180|| Column | Type | Notes |
   181||--------|------|-------|
   182|| `key` | `text` PK | Unique config key |
   183|| `value` | `jsonb` | Arbitrary config payload |
   184|| `updated_at` | `timestamptz` | Last modified |
   185|
   186|### `soonsnap_projects`
   187|Top‑level containers for user work.
   188|
   189|| Column | Type | Notes |
   190||--------|------|-------|
   191|| `id` | `uuid` PK | |
   192|| `user_id` | `uuid` FK → `auth.users` | Owner |
   193|| `name` | `text` | Project title |
   194|| `url` | `text` | Target website URL |
   195|| `style` | `text` | `cinematic` · `social_ad` · `tutorial` · `minimal` |
   196|| `created_at` | `timestamptz` | |
   197|
   198|### `soonsnap_versions`
   199|Versioned snapshots of a project's composition state.
   200|
   201|| Column | Type | Notes |
   202||--------|------|-------|
   203|| `id` | `uuid` PK | |
   204|| `project_id` | `uuid` FK | Parent project |
   205|| `version` | `integer` | Monotonic version number |
   206|| `composition` | `jsonb` | AI‑generated scene data |
   207|| `status` | `text` | `draft` · `rendering` · `done` |
   208|| `created_at` | `timestamptz` | |
   209|
   210|### `soonsnap_jobs`
   211|The processing queue. The systemd worker polls this table.
   212|
   213|| Column | Type | Notes |
   214||--------|------|-------|
   215|| `id` | `uuid` PK | |
   216|| `project_id` | `uuid` FK | |
   217|| `version_id` | `uuid` FK | |
   218|| `status` | `text` | `queued` · `capturing` · `composing` · `rendering` · `done` · `failed` |
   219|| `progress` | `integer` | 0–100 |
   220|| `error_message` | `text` | Null if OK |
   221|| `output_path` | `text` | Final video file location |
   222|| `created_at` | `timestamptz` | |
   223|| `updated_at` | `timestamptz` | |
   224|
   225|### `soonsnap_credits`
   226|User credit balances for the upcoming billing system.
   227|
   228|| Column | Type | Notes |
   229||--------|------|-------|
   230|| `id` | `uuid` PK | |
   231|| `user_id` | `uuid` FK → `auth.users` | |
   232|| `balance` | `integer` | Remaining credits |
   233|| `tier` | `text` | `free` · `pro` · `enterprise` |
   234|| `updated_at` | `timestamptz` | |
   235|
   236|### `soonsnap_wallets`
   237|Solana wallet mappings (Helius integration, planned).
   238|
   239|| Column | Type | Notes |
   240||--------|------|-------|
   241|| `id` | `uuid` PK | |
   242|| `user_id` | `uuid` FK → `auth.users` | |
   243|| `wallet_address` | `text` | Solana public key |
   244|| `created_at` | `timestamptz` | |
   245|
   246|---
   247|
   248|## API Endpoints
   249|
   250|### Job Management
   251|
   252|| Method | Path | Description |
   253||--------|------|-------------|
   254|| `POST` | `/api/jobs` | Create a new render job (queue it) |
   255|| `GET` | `/api/jobs` | List jobs for the authenticated user |
   256|| `GET` | `/api/jobs/[id]` | Get job status, progress, and output URL |
   257|| `POST` | `/api/jobs/[id]/retry` | Re‑queue a failed job |
   258|
   259|### Projects
   260|
   261|| Method | Path | Description |
   262||--------|------|-------------|
   263|| `POST` | `/api/projects` | Create a new project |
   264|| `GET` | `/api/projects` | List user's projects |
   265|| `GET` | `/api/projects/[id]` | Get project details |
   266|| `PATCH` | `/api/projects/[id]` | Update project (URL, style, name) |
   267|| `DELETE` | `/api/projects/[id]` | Delete project and its versions |
   268|
   269|### Config & Health
   270|
   271|| Method | Path | Description |
   272||--------|------|-------------|
   273|| `GET` | `/api/config` | Read public app config (LLM models, limits) |
   274|| `PATCH` | `/api/config` | Update config *(admin only)* |
   275|| `GET` | `/api/health` | System health check (worker status, DB, disk) |
   276|
   277|---
   278|
   279|## Admin · Lisa Omnipresent PWA
   280|
   281|SoonSnap is managed day‑to‑day through **Lisa Omnipresent** — a companion admin PWA maintained at [Lisa‑KimDev](https://github.com/Lisa-KimDev). From a single dark‑mode dashboard you can:
   282|
   283|- **User Management** — View, search, and manage registered users
   284|- **LLM Picker** — Swap AI models in real time; no redeploy required
   285|- **Video Queue** — Monitor live job progress, retry failures, view output
   286|- **Server Monitoring** — CPU, memory, disk, and worker heartbeat on `173.249.36.76`
   287|
   288|The admin UI shares the Lisa Kim design language: `#111111` base, `#e7f900` neon accents, clean white type. Premium, dark, fast.
   289|
   290|---
   291|
   292|## Deployment
   293|
   294|### Frontend — Vercel
   295|
   296|```bash
   297|# Push to main, Vercel auto-deploys
   298|git push origin main
   299|```
   300|
   301|Environment variables are configured in the Vercel dashboard. Ensure `NEXT_PUBLIC_*` vars are set for the edge.
   302|
   303|### Worker — systemd on Bare Metal
   304|
   305|The worker runs as a systemd service on `173.249.36.76`, polling Supabase every 3 seconds.
   306|
   307|**Service file** — `/etc/systemd/system/soonsnap-worker.service`:
   308|
   309|```ini
   310|[Unit]
   311|Description=SoonSnap Video Worker
   312|After=network.target
   313|
   314|[Service]
   315|Type=simple
   316|WorkingDirectory=/opt/soonsnap-app
   317|ExecStart=/usr/bin/node dist/worker.js
   318|Restart=always
   319|RestartSec=5
   320|Environment=NODE_ENV=production
   321|
   322|[Install]
   323|WantedBy=multi-user.target
   324|```
   325|
   326|```bash
   327|sudo systemctl daemon-reload
   328|sudo systemctl enable soonsnap-worker
   329|sudo systemctl start soonsnap-worker
   330|sudo systemctl status soonsnap-worker   # verify
   331|```
   332|
   333|### Video Serving — nginx
   334|
   335|nginx serves rendered MP4s from disk and exposes them to the Vercel proxy:
   336|
   337|```nginx
   338|server {
   339|    listen 80;
   340|    server_name 173.249.36.76;
   341|
   342|    location /videos/ {
   343|        alias /var/www/soonsnap/videos/;
   344|        mp4;
   345|        mp4_buffer_size 1m;
   346|        mp4_max_buffer_size 5m;
   347|        add_header Access-Control-Allow-Origin *;
   348|    }
   349|
   350|    location /api/health {
   351|        proxy_pass http://127.0.0.1:3000;
   352|    }
   353|}
   354|```
   355|
   356|---
   357|
   358|## Brand
   359|
   360|SoonSnap is a **Lisa Kim** product. The visual identity is intentional:
   361|
   362|- **Black** `#111111` — the void, the base
   363|- **Neon Yellow** `#e7f900` — electric, unmistakable
   364|- **White** `#ffffff` — clarity, contrast
   365|
   366|Everything ships dark. Everything glows a little.
   367|
   368|---
   369|
   370|## License
   371|
   372|Released under the **MIT License**. See [LICENSE](./LICENSE) for details.
   373|
   374|---
   375|
   376|<div align="center">
   377|
   378|**[Richy‑Soonak](https://github.com/Richy-Soonak) · [Lisa‑KimDev](https://github.com/Lisa-KimDev)**
   379|
   380|*Ryu · v0.2.5*
   381|
   382|</div>
   383|