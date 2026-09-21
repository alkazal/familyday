# Family Day 2026 Admin

Internal web app for managing Family Day 2026 data (participants, rooms, seating, teams, attendance, awards) with:

- `backend/`: Node.js + Express API that reads Excel sources
- `frontend/`: React + Vite admin/staff interfaces

## Documentation

- API contract: [backend/API_CONTRACT.md](backend/API_CONTRACT.md)

## Quick Start

### Option A — Start both apps at once (recommended)

```bash
npm install          # installs root devDependencies (concurrently)
npm run install:all  # installs backend + frontend dependencies
npm run dev          # starts backend and frontend together
```

### Option B — Start individually

```bash
# Backend (http://localhost:5000)
cd backend && npm install && npm run dev

# Frontend (URL shown by Vite)
cd frontend && npm install && npm run dev
```

### Frontend API port override

- Copy `frontend/.env.example` to `frontend/.env`
- Set `VITE_API_URL=http://localhost:5050` (or any backend port)
- Restart the frontend dev server after editing `.env`

## App Routes

- Admin app: `/`
- Staff app: `/staff`

## Supabase Attendance Persistence (Recommended for Vercel)

Create this table in Supabase SQL Editor:

```sql
create table if not exists public.staff_attendance_overrides (
	login_code text primary key,
	attendance text not null check (attendance in ('Hadir', 'Tidak Hadir')),
	updated_at timestamptz not null default now()
);
```

Add these environment variables in Vercel (Project Settings → Environment Variables):

- `SUPABASE_URL` = your project URL (example: `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role key

Notes:

- Backend auto-uses Supabase when both variables exist.
- If variables are missing, backend falls back to `backend/data/staff-attendance-overrides.json`.
