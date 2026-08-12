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

## Deploy to Cloudflare Workers

Uses [@opennextjs/cloudflare](https://opennext.js.org/cloudflare).

1. Copy `.dev.vars.example` → `.dev.vars` (set `NEXTJS_ENV=development`). Keep Supabase vars in `.env.local` / `.env.production` for Next builds.
2. Preview on the Workers runtime:

```bash
npm run preview
```

3. Deploy:

```bash
npx wrangler login
npm run deploy
```

4. In the Cloudflare dashboard → Workers → **palawansu-hotel-pms** → Settings → Variables and Secrets, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   For Git/Workers Builds, also add those under **Build variables and secrets**.

5. In Supabase → **Authentication → URL Configuration**, add your Workers URL to Site URL / Redirect URLs  
   (e.g. `https://palawansu-hotel-pms.<account>.workers.dev`).

Optional: enable R2 and uncomment `r2_buckets` in `wrangler.jsonc` for Next.js incremental cache.

## Importing old SQLite seed data

After tables exist, you can import your Desktop `INSERT` SQL files for rooms/guests/reservations/etc.
Do **not** import `users.sql` (plaintext passwords) or `public.sql` (LMS schema).

## Notes

- Legacy Electron/Vite UI lives under `src/legacy-pages` for gradual porting.
- `npm run dev` = Next.js. Old Vite: `npm run dev:vite`.
- `npm run deploy` = OpenNext build + Cloudflare Workers deploy.
