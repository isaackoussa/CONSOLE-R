-- Console R : table des sauvegardes en ligne (une ligne JSON par compte).
-- À exécuter une fois dans Supabase → SQL Editor → New query → Run.
create table if not exists public.backups (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.backups enable row level security;

-- Chaque compte ne voit et ne modifie que sa propre sauvegarde
drop policy if exists "lire sa sauvegarde" on public.backups;
drop policy if exists "créer sa sauvegarde" on public.backups;
drop policy if exists "modifier sa sauvegarde" on public.backups;
create policy "lire sa sauvegarde" on public.backups for select using (auth.uid() = user_id);
create policy "créer sa sauvegarde" on public.backups for insert with check (auth.uid() = user_id);
create policy "modifier sa sauvegarde" on public.backups for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
