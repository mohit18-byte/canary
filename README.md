<p align="center">
  <h1 align="center">🐤 Canary</h1>
  <p align="center"><strong>Autonomous API Change Monitoring Agent</strong></p>
  <p align="center">
    Canary watches the APIs you depend on — detects breaking changes, classifies impact with AI, and tells you exactly what to fix. Before production breaks.
  </p>
</p>

<p align="center"><em>From changelog → to impact → to exact fix → before production breaks.</em></p>

<p align="center">
  <a href="#how-it-works">How It Works</a> ·
  <a href="#features">Features</a> ·
  <a href="#getting-started">Get Started</a> ·
  <a href="#demo">Demo</a>
</p>

---

## The Problem

Every modern application depends on third-party APIs. Stripe, OpenAI, GitHub, Twilio — they all ship changes constantly.

**But here's what actually happens:**

- A provider deprecates an endpoint. You find out when production returns `410 Gone`.
- A model you depend on gets sunset. Your AI features silently degrade.
- A breaking change ships in a changelog you never read. Customers report the bug before you do.

API changelogs exist, but nobody reads them. Status pages exist, but nobody refreshes them. The information is public — the problem is **nobody is watching**.

> Teams lose hours — sometimes days — debugging failures caused by upstream API changes they could have caught in minutes.

---

## The Solution

Canary is an autonomous agent that monitors API changelogs so you don't have to.

```
  Scrape             Diff              Classify           Alert
┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────┐
│ TinyFish │ →  │  Snapshot   │ →  │   GPT-4o     │ →  │  Email +  │
│  Agent   │    │  Comparison │    │  Analysis    │    │ Dashboard │
└─────────┘    └─────────────┘    └──────────────┘    └───────────┘
```

**Detect** breaking changes from real changelog pages.  
**Analyze** urgency, impact, and timeline using AI.  
**Fix** — get specific, actionable migration guidance with code examples.  
**Alert** — high-urgency changes trigger instant email notifications.

Canary doesn't just detect changes — it tells you exactly what will break and how to fix it.

---

## How It Works

Canary runs a 6-stage pipeline every time you trigger a scan:

### 1. 🌐 Scrape Changelogs
A TinyFish browser agent navigates to the provider's actual changelog page, renders JavaScript, and extracts structured data — dates, titles, summaries, categories.

### 2. 🔍 Diff Against Snapshot
The extracted data is compared against the last stored snapshot using content hashing (fast path) and entry-level diffing (granular path). First scan establishes a baseline.

### 3. 🧠 Classify with AI
New changes are batched into a single GPT-4o call. Each change is classified with:
- **Change type** — breaking, deprecation, or feature
- **Urgency score** — 1 to 10
- **Impact** — what breaks in production
- **Action required** — specific migration instruction
- **Code example** — before/after fix

### 4. 💾 Persist Results
Snapshots and classified changes are stored in Supabase for historical tracking and dashboard rendering.

### 5. 📡 Stream to Dashboard
Every pipeline step emits real-time SSE events. The dashboard renders an agent-style progress log — you watch the AI think, analyze, and classify in real time.

### 6. 📧 Alert on Critical Changes
Changes with urgency ≥ 7 or breaking type trigger an email alert via Resend with impact summary, action required, and suggested fix.

---

## Features

- **Real-time changelog monitoring** — scrapes live API changelog pages using browser automation
- **Breaking change detection** — identifies deprecations, removals, and behavioral changes
- **AI-powered classification** — GPT-4o scores urgency, generates impact analysis, and suggests fixes with code
- **Live agent dashboard** — watch the scan happen in real time with animated SSE progress
- **Email alerts** — critical changes trigger instant email notifications with full context
- **Custom provider support** — add any API with a changelog URL
- **Snapshot diffing** — only surfaces genuinely new changes, not noise
- **Scan cancellation** — stop scans mid-flight, including remote TinyFish run cancellation
- **GitHub repo scanning** — _coming soon_ — scan your repo's dependencies and map changes to affected code

---

## Demo

### Homepage
<p align="center">
  <img src="public/screenshots/homepage.png" alt="Canary Homepage" width="700" />
</p>

### Dashboard — Live Scan
<p align="center">
  <img src="public/screenshots/dashboard-scan.png" alt="Dashboard Live Scan" width="700" />
</p>

### Dashboard — Classified Changes
<p align="center">
  <img src="public/screenshots/dashboard-changes.png" alt="Classified Changes Feed" width="700" />
</p>

### Scan Repo (Coming Soon)
<p align="center">
  <img src="public/screenshots/scanrepo.png" alt="Scan Repo Page" width="700" />
</p>

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (App Router) | Full-stack React with server-side API routes |
| **Language** | TypeScript | Type-safe codebase |
| **Styling** | Tailwind CSS v4 | Utility-first dark-mode UI |
| **Database** | Supabase (PostgreSQL) | Providers, scans, snapshots, changes |
| **Scraping** | TinyFish | Browser automation agent for changelog extraction |
| **AI** | OpenAI GPT-4o | Change classification, impact analysis, fix generation |
| **Email** | Resend | Critical change email alerts |
| **Deployment** | Vercel | Serverless deployment with SSE streaming |

---

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm
- Supabase project
- API keys for TinyFish, OpenAI, and Resend

### Installation

```bash
# Clone the repository
git clone https://github.com/mohit18-byte/canary.git
cd canary

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Fill in your API keys (see Environment Variables below)

# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see Canary.

### Database Setup

Run the migration in your Supabase SQL Editor:

```bash
# Core schema (providers, scans, snapshots)
supabase/migration.sql

# Changes table (classified results)
supabase/migrations/create_changes_table.sql
```

---

## Environment Variables

Create a `.env.local` file with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# TinyFish (browser automation)
TINYFISH_API_KEY=your_tinyfish_api_key

# OpenAI (AI classification)
OPENAI_API_KEY=your_openai_api_key

# Resend (email alerts)
RESEND_API_KEY=your_resend_api_key
ALERT_EMAIL_TO=your_email@example.com
```

> **Security:** Only `NEXT_PUBLIC_` variables are exposed to the browser. All API keys are server-side only.

---

## Deployment

Canary is optimized for **Vercel**:

```bash
# Deploy to Vercel
vercel --prod
```

1. Connect your repository to Vercel
2. Add all environment variables in **Settings → Environment Variables**
3. Deploy — Vercel handles the rest

The scan endpoint uses `maxDuration = 300` (5 minutes) to accommodate long-running TinyFish scrapes. This requires a Vercel Pro plan for production use.

---

## Project Structure

```
canaryApi/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Landing page
│   │   ├── dashboard/page.tsx        # Main dashboard + scan UI
│   │   ├── scanrepo/page.tsx         # GitHub repo scanning (coming soon)
│   │   ├── docs-viewer/page.tsx      # External docs viewer
│   │   └── api/
│   │       ├── scan/route.ts         # POST: SSE scan pipeline
│   │       ├── cancel-scan/route.ts  # POST: Cancel active scan
│   │       ├── changes/route.ts      # GET: Persisted results
│   │       ├── providers/route.ts    # CRUD: Provider management
│   │       └── docs-proxy/route.ts   # GET: Documentation proxy
│   ├── lib/
│   │   ├── tinyfish.ts               # TinyFish SSE client
│   │   ├── scraper.ts                # Provider scraping orchestration
│   │   ├── prompts.ts                # Extraction prompt templates
│   │   ├── diff-engine.ts            # Snapshot comparison
│   │   ├── ai-classifier.ts          # GPT-4o classification
│   │   ├── scan-engine.ts            # Pipeline orchestrator
│   │   ├── email-alerter.ts          # Resend email client
│   │   ├── providers.ts              # Seed data + helpers
│   │   └── supabase.ts               # Database client
│   └── types/index.ts                # TypeScript definitions
└── supabase/
    ├── migration.sql                 # Core database schema
    └── migrations/                   # Additional migrations
```

---

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| ✅ | Real-time changelog scraping | Shipped |
| ✅ | AI classification with GPT-4o | Shipped |
| ✅ | Live SSE dashboard | Shipped |
| ✅ | Email alerts via Resend | Shipped |
| ✅ | Custom provider support | Shipped |
| 🚧 | GitHub repo scanning | In progress |
| 📋 | Auto-generate PRs with fixes | Planned |
| 📋 | CI/CD pipeline integration | Planned |
| 📋 | Scheduled scans (cron) | Planned |
| 📋 | Slack / webhook notifications | Planned |
| 📋 | Multi-user teams + auth | Planned |

---

## Why This Matters

Most production outages caused by APIs are not bugs — they are unnoticed changes.

Every company that integrates third-party APIs faces the same invisible risk: **the API you depend on will change, and you won't know until something breaks.**

Stripe has deprecated 47 API versions. OpenAI has sunset 12 models. GitHub ships changelog updates weekly. These changes are documented — but buried in pages nobody monitors.

Canary turns changelog pages into **actionable intelligence**. It doesn't just tell you something changed — it tells you what breaks, how urgent it is, and exactly how to fix it.

> The cost of not knowing is a production incident. The cost of Canary is a 30-second scan.

---

## Built With

<p align="center">
  Built with <a href="https://tinyfish.ai">TinyFish</a> · TinyFish Hackathon 2026
</p>

---

<p align="center">
  <sub>🐤 Canary — Your APIs will change. You'll know first.</sub>
</p>
