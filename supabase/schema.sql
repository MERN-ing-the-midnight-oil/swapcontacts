-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.outreach_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  outreach jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.outreach_state enable row level security;

create policy "Users read own outreach"
  on public.outreach_state for select
  using (auth.uid() = user_id);

create policy "Users insert own outreach"
  on public.outreach_state for insert
  with check (auth.uid() = user_id);

create policy "Users update own outreach"
  on public.outreach_state for update
  using (auth.uid() = user_id);

-- Realtime (optional — enables live sync across tabs/devices)
alter publication supabase_realtime add table public.outreach_state;
