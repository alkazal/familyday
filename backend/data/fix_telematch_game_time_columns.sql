-- Family Day 2026 - Telematch schema compatibility patch
-- Run once in Supabase SQL Editor on an existing database.

alter table public.telematch_games
  add column if not exists start_time text;

alter table public.telematch_games
  add column if not exists end_time text;

-- Optional verification
select id, name, category, location, start_time, end_time, max_team_members
from public.telematch_games
order by created_at asc;
