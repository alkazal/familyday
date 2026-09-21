-- Telematch module schema for Supabase (PostgreSQL)
-- Run this once in Supabase SQL editor.

create table if not exists public.telematch_games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null check (category in ('Adult','Kid','Open')),
  location text,
  max_team_members integer not null check (max_team_members > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telematch_participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age integer not null default 0 check (age >= 0),
  category text not null check (category in ('Adult','Kid','Open')),
  team_color text not null check (team_color in ('Green','Yellow','Red','Blue')),
  owner_login_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telematch_registrations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.telematch_participants(id) on delete cascade,
  game_id uuid not null references public.telematch_games(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (participant_id, game_id)
);

create index if not exists idx_telematch_registrations_participant on public.telematch_registrations(participant_id);
create index if not exists idx_telematch_registrations_game on public.telematch_registrations(game_id);
create index if not exists idx_telematch_participants_owner on public.telematch_participants(owner_login_code);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_telematch_games_updated_at on public.telematch_games;
create trigger trg_telematch_games_updated_at
before update on public.telematch_games
for each row execute function public.set_updated_at();

drop trigger if exists trg_telematch_participants_updated_at on public.telematch_participants;
create trigger trg_telematch_participants_updated_at
before update on public.telematch_participants
for each row execute function public.set_updated_at();
