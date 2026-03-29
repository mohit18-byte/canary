-- ============================================================
-- Canary — Database Schema
-- ============================================================

-- 1. Providers
CREATE TABLE IF NOT EXISTS providers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  slug            TEXT        UNIQUE NOT NULL,
  logo_url        TEXT,
  changelog_url   TEXT        NOT NULL,
  deprecation_url TEXT,
  status_url      TEXT,
  is_custom       BOOLEAN     DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Scans
CREATE TABLE IF NOT EXISTS scans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  status          TEXT        NOT NULL DEFAULT 'running'
                              CHECK (status IN ('running', 'completed', 'failed')),
  provider_ids    TEXT[]      NOT NULL,
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  error           TEXT
);

-- 3. Snapshots
CREATE TABLE IF NOT EXISTS snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  scan_id         UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  source_type     TEXT        NOT NULL
                              CHECK (source_type IN ('changelog', 'deprecation', 'status')),
  raw_data        JSONB       NOT NULL,
  content_hash    TEXT        NOT NULL,
  captured_at     TIMESTAMPTZ DEFAULT now()
);

-- 4. Changes
CREATE TABLE IF NOT EXISTS changes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  provider_id     UUID        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  source_type     TEXT        NOT NULL
                              CHECK (source_type IN ('changelog', 'deprecation', 'status')),
  title           TEXT        NOT NULL,
  raw_content     TEXT,
  change_type     TEXT        NOT NULL
                              CHECK (change_type IN ('breaking', 'deprecation', 'feature', 'incident', 'resolved')),
  urgency         INTEGER     NOT NULL CHECK (urgency >= 1 AND urgency <= 10),
  summary         TEXT,
  action_required TEXT,
  timeline        TEXT        CHECK (timeline IN ('immediate', 'soon', 'later')),
  detected_at     TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_snapshots_provider ON snapshots(provider_id, source_type);
CREATE INDEX IF NOT EXISTS idx_changes_scan      ON changes(scan_id);
CREATE INDEX IF NOT EXISTS idx_changes_provider   ON changes(provider_id);
CREATE INDEX IF NOT EXISTS idx_changes_urgency    ON changes(urgency DESC);

-- ============================================================
-- Seed Data — 5 Default Providers
-- ============================================================

INSERT INTO providers (name, slug, changelog_url, deprecation_url, status_url, is_custom)
VALUES
  ('Stripe',  'stripe',  'https://stripe.com/blog/changelog',           'https://stripe.com/docs/upgrades',          'https://status.stripe.com',       false),
  ('OpenAI',  'openai',  'https://platform.openai.com/docs/changelog',  'https://platform.openai.com/docs/deprecations', 'https://status.openai.com',  false),
  ('GitHub',  'github',  'https://github.blog/changelog/',              'https://github.blog/changelog/',            'https://www.githubstatus.com',    false),
  ('Twilio',  'twilio',  'https://www.twilio.com/en-us/changelog',      'https://www.twilio.com/en-us/changelog',    'https://status.twilio.com',       false),
  ('Vercel',  'vercel',  'https://vercel.com/changelog',                'https://vercel.com/changelog',              'https://www.vercel-status.com',   false)
ON CONFLICT (slug) DO NOTHING;
