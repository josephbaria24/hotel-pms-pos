-- PalawanSU Hotel PMS — Supabase / Postgres schema
-- Run this in Supabase Dashboard → SQL Editor

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Staff profiles (linked to Supabase Auth; do NOT store plaintext passwords)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_type_options (
  id text primary key,
  value text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_status_options (
  id text primary key,
  value text not null unique,
  disables_room boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.housekeepers (
  id text primary key,
  name text not null,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id text primary key,
  room_number text not null unique,
  type text not null,
  floor text,
  capacity integer not null default 1,
  rate numeric(12, 2) not null default 0,
  status text not null default 'available',
  notes text,
  condition text not null default 'clean',
  do_not_disturb boolean not null default false,
  assigned_housekeeper_id text references public.housekeepers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guests (
  id text primary key,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  address text,
  id_type text,
  id_number text,
  nationality text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id text primary key,
  reservation_number text not null unique,
  guest_id text not null references public.guests (id),
  room_id text not null references public.rooms (id),
  check_in_date date not null,
  check_out_date date not null,
  adults integer not null default 1,
  children integer not null default 0,
  status text not null default 'reserved'
    check (status in ('reserved', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  source text default 'walk_in',
  total_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  actual_check_in_at timestamptz,
  actual_check_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key,
  reservation_id text not null references public.reservations (id) on delete cascade,
  amount numeric(12, 2) not null,
  method text not null default 'cash',
  reference_no text,
  note text,
  received_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id text primary key,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id text primary key default 'main',
  hotel_name text not null default 'PalawanSU Hotel',
  address text not null default '',
  contact_number text not null default '',
  email text not null default '',
  check_in_time text not null default '14:00',
  check_out_time text not null default '12:00',
  currency text not null default 'Peso',
  tax_rate numeric(8, 4) not null default 0,
  updated_at timestamptz not null default now()
);

-- Defaults
insert into public.settings (id, hotel_name, address, contact_number, currency)
values ('main', 'PalawanSU Hotel', 'Palawan State University Roxas Campus', '0912345678', 'Peso')
on conflict (id) do nothing;

insert into public.room_type_options (id, value) values
  (gen_random_uuid()::text, 'single'),
  (gen_random_uuid()::text, 'double'),
  (gen_random_uuid()::text, 'deluxe'),
  (gen_random_uuid()::text, 'suite'),
  (gen_random_uuid()::text, 'family')
on conflict (value) do nothing;

insert into public.room_status_options (id, value, disables_room) values
  (gen_random_uuid()::text, 'available', false),
  (gen_random_uuid()::text, 'occupied', false),
  (gen_random_uuid()::text, 'cleaning', true),
  (gen_random_uuid()::text, 'maintenance', true)
on conflict (value) do nothing;

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.guests enable row level security;
alter table public.reservations enable row level security;
alter table public.payments enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;
alter table public.housekeepers enable row level security;
alter table public.room_type_options enable row level security;
alter table public.room_status_options enable row level security;

-- Authenticated staff can read/write hotel data (tighten later by role)
drop policy if exists "Authenticated read profiles" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Authenticated all rooms" on public.rooms;
drop policy if exists "Authenticated all guests" on public.guests;
drop policy if exists "Authenticated all reservations" on public.reservations;
drop policy if exists "Authenticated all payments" on public.payments;
drop policy if exists "Authenticated all activity_logs" on public.activity_logs;
drop policy if exists "Authenticated all settings" on public.settings;
drop policy if exists "Authenticated all housekeepers" on public.housekeepers;
drop policy if exists "Authenticated all room_type_options" on public.room_type_options;
drop policy if exists "Authenticated all room_status_options" on public.room_status_options;

create policy "Authenticated read profiles" on public.profiles
  for select to authenticated using (true);
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

create policy "Authenticated all rooms" on public.rooms
  for all to authenticated using (true) with check (true);
create policy "Authenticated all guests" on public.guests
  for all to authenticated using (true) with check (true);
create policy "Authenticated all reservations" on public.reservations
  for all to authenticated using (true) with check (true);
create policy "Authenticated all payments" on public.payments
  for all to authenticated using (true) with check (true);
create policy "Authenticated all activity_logs" on public.activity_logs
  for all to authenticated using (true) with check (true);
create policy "Authenticated all settings" on public.settings
  for all to authenticated using (true) with check (true);
create policy "Authenticated all housekeepers" on public.housekeepers
  for all to authenticated using (true) with check (true);
create policy "Authenticated all room_type_options" on public.room_type_options
  for all to authenticated using (true) with check (true);
create policy "Authenticated all room_status_options" on public.room_status_options
  for all to authenticated using (true) with check (true);

create index if not exists reservations_room_dates_idx
  on public.reservations (room_id, check_in_date, check_out_date);
create index if not exists reservations_status_idx
  on public.reservations (status);
create index if not exists payments_reservation_idx
  on public.payments (reservation_id);
create index if not exists guests_name_idx
  on public.guests (last_name, first_name);
