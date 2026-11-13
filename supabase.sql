-- Kör i Supabase: SQL Editor → New query → Run
create table if not exists public.collections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.collections enable row level security;
drop policy if exists "egen rad läs" on public.collections;
drop policy if exists "egen rad skriv" on public.collections;
drop policy if exists "egen rad ändra" on public.collections;
create policy "egen rad läs" on public.collections for select using (auth.uid() = user_id);
create policy "egen rad skriv" on public.collections for insert with check (auth.uid() = user_id);
create policy "egen rad ändra" on public.collections for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
