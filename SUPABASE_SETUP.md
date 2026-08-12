# PalawanSU Hotel — Next.js + Supabase

## Setup

1. Copy `.env.example` → `.env.local` (already configured for your project).
2. In Supabase Dashboard → **SQL Editor**, run in order:
   - `supabase/migrations/001_hotel_schema.sql`
   - `supabase/migrations/002_pos_schema.sql` (POS catalog, tables, orders, payments)
3. In Supabase → **Authentication → Users → Add user**:
   - Email: e.g. `admin@palawansu.hotel`
   - Password: choose a strong password
   - Optional user metadata: `{ "full_name": "Administrator", "role": "admin", "username": "admin" }`
4. Run the app:

```bash
npm run dev
```

Open http://localhost:3000 — login with that email/password.

## Importing old SQLite seed data

After tables exist, you can import your Desktop `INSERT` SQL files for rooms/guests/reservations/etc.
Do **not** import `users.sql` (plaintext passwords) or `public.sql` (LMS schema).

## Notes

- Legacy Electron/Vite UI lives under `src/legacy-pages` for gradual porting.
- `npm run dev` = Next.js. Old Vite: `npm run dev:vite`.
