-- Canary: changes table for persisting AI-classified scan results
-- Run this in your Supabase SQL Editor

create table if not exists changes (
  id uuid default gen_random_uuid() primary key,
  scan_id uuid references scans(id) on delete cascade,
  provider_id uuid references providers(id) on delete cascade,
  provider_name text not null,
  title text not null,
  date text default 'Unknown',
  source text default 'changelog',
  change_type text not null check (change_type in ('breaking', 'deprecation', 'feature', 'incident', 'resolved')),
  urgency integer not null default 3 check (urgency >= 1 and urgency <= 10),
  impact text not null default '',
  action_required text not null default '',
  suggested_fix text default '',
  code_example text default '',
  timeline text default 'later' check (timeline in ('immediate', 'soon', 'later')),
  created_at timestamptz default now()
);

-- Index for fast dashboard queries
create index if not exists idx_changes_created_at on changes(created_at desc);
create index if not exists idx_changes_provider on changes(provider_name);

-- Enable RLS (allow reads for anon key)
alter table changes enable row level security;

create policy "Allow public read" on changes for select using (true);
create policy "Allow insert" on changes for insert with check (true);
