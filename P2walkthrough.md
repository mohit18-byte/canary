# Canary — Walkthrough

## Phase 1 — Foundation ✅

Scaffolded the entire project from scratch:

| File | Purpose |
|------|---------|
| [layout.tsx](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/src/app/layout.tsx) | Root layout with Inter + Sora fonts |
| [page.tsx](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/src/app/page.tsx) | Vercel-style landing page |
| [dashboard/page.tsx](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/src/app/dashboard/page.tsx) | Two-column dashboard (provider selector + feed) |
| [types/index.ts](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/src/types/index.ts) | TypeScript types for all entities |
| [lib/supabase.ts](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/src/lib/supabase.ts) | Supabase client |
| [lib/providers.ts](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/src/lib/providers.ts) | 5 seed providers + avatar helpers |
| [supabase/migration.sql](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/supabase/migration.sql) | DB schema + seed data |

---

## Phase 2 — TinyFish Scraper ✅

### Files Created

| File | Purpose |
|------|---------|
| [tinyfish.ts](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/src/lib/tinyfish.ts) | TinyFish SSE endpoint client with 5-min timeout |
| [prompts.ts](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/src/lib/prompts.ts) | 3 goal prompt templates (changelog, deprecation, status) |
| [scraper.ts](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/src/lib/scraper.ts) | Parallel scraper with `Promise.allSettled` + JSON extraction |
| [test-scrape.ts](file:///c:/Users/rohit/OneDrive/Desktop/canaryApi/scripts/test-scrape.ts) | Test script with file output |

### Key Decisions

- **SSE endpoint** (`/v1/automation/run-sse`) instead of sync (`/run`) — sync timed out at 90s
- **`X-API-Key`** header (not `Authorization: Bearer`)
- **`browser_profile: "stealth"`** for anti-bot protection
- **5-minute timeout** — TinyFish needs 1-4 minutes per complex page
- **Robust JSON extraction** — handles raw objects, markdown fences, and embedded JSON

### Stripe Test Scan — ✅ 3/3 Sources

```
📋 Changelog   : ✅  83.4s
⚠️  Deprecation : ✅  280.0s
🟢 Status      : ✅  172.8s
────────────────────────
Total          : 280.1s
```

### Full JSON Output

```json
{
  "provider": "Stripe",
  "total_duration_seconds": 280.1,
  "sources": {
    "changelog": {
      "success": true,
      "duration_seconds": 83.4,
      "data": {
        "entries": [
          {
            "date": "2026-03-01",
            "title": "Platforms can now embed account onboarding, payments, and payouts components in their React Native mobile applications (preview).",
            "summary": "Platforms can now embed account onboarding, payments, and payouts components directly into their React Native mobile applications.",
            "type": "feature"
          },
          {
            "date": "2026-02-01",
            "title": "Automated US sales tax filing via TaxJar is now available directly in the Dashboard.",
            "summary": "Automated US sales tax filing through TaxJar is now accessible directly within the Stripe Dashboard for 16 US states.",
            "type": "feature"
          },
          {
            "date": "2025-12-01",
            "title": "The Accounts v2 API is now generally available for new Connect users.",
            "summary": "The Accounts v2 API is now generally available, allowing new Connect users to represent both connected accounts and customers across Stripe.",
            "type": "feature"
          }
        ]
      }
    },
    "deprecation": {
      "success": true,
      "duration_seconds": 280.0,
      "data": {
        "deprecations": [
          {
            "endpoint_name": "fleet.cardholder_prompt_data.alphanumeric_id property on Issuing Authorization",
            "sunset_date": "unknown",
            "migration_path": "Use driver_id, vehicle_number, unspecified_id, or user_id instead."
          },
          {
            "endpoint_name": "bank_transfer_payments capability type",
            "sunset_date": "unknown",
            "migration_path": "Use gb_bank_transfer_payments, jp_bank_transfer_payments, mx_bank_transfer_payments, sepa_bank_transfer_payments, or us_bank_transfer_payments instead."
          },
          {
            "endpoint_name": "payment_method.card_automatically_updated webhook",
            "sunset_date": "unknown",
            "migration_path": "Use payment_method.automatically_updated instead."
          },
          {
            "endpoint_name": "prorate and subscription_prorate parameters",
            "sunset_date": "unknown",
            "migration_path": "Use proration_behavior instead."
          }
        ]
      }
    },
    "status": {
      "success": true,
      "duration_seconds": 172.8,
      "data": {
        "overall_status": "operational",
        "active_incidents": [],
        "recent_incidents": [
          { "title": "Scheduled maintenance for BLIK", "date": "2026-03-25", "status": "resolved" },
          { "title": "Scheduled maintenance for TWINT", "date": "2026-03-25", "status": "resolved" },
          { "title": "Scheduled maintenance for TWINT - Finnova (ENTB+ZGKB)", "date": "2026-03-25", "status": "resolved" }
        ]
      }
    }
  },
  "summary": { "succeeded": 3, "total": 3 }
}
```

> [!TIP]
> The deprecation source takes the longest (280s) because Stripe's upgrades page is complex with lots of JS rendering. For demos, consider pre-warming the scan.
