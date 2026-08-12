-- PalawanSU Hotel POS — Supabase / Postgres schema
-- Run after 001_hotel_schema.sql in Supabase Dashboard → SQL Editor

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table if not exists public.pos_categories (
  id text primary key,
  name text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pos_products (
  id text primary key,
  category_id text references public.pos_categories (id) on delete set null,
  sku text unique,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  track_stock boolean not null default false,
  stock_qty numeric(12, 3) not null default 0,
  unit text not null default 'each',
  is_active boolean not null default true,
  is_quick_sell boolean not null default false,
  sort_order integer not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Floor plan / dining tables
-- ---------------------------------------------------------------------------
create table if not exists public.pos_tables (
  id text primary key,
  name text not null unique,
  zone text not null default 'Main',
  seats integer not null default 4 check (seats > 0),
  status text not null default 'available'
    check (status in ('available', 'occupied', 'reserved', 'dirty', 'inactive')),
  pos_x numeric(8, 2),
  pos_y numeric(8, 2),
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders (tickets)
-- ---------------------------------------------------------------------------
create table if not exists public.pos_orders (
  id text primary key,
  order_number text not null unique,
  status text not null default 'open'
    check (status in ('open', 'held', 'paid', 'void', 'refunded')),
  order_type text not null default 'walk_in'
    check (order_type in ('walk_in', 'dine_in', 'takeout', 'room_charge', 'other')),
  table_id text references public.pos_tables (id) on delete set null,
  guest_id text references public.guests (id) on delete set null,
  reservation_id text references public.reservations (id) on delete set null,
  room_id text references public.rooms (id) on delete set null,
  customer_name text,
  subtotal numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  notes text,
  opened_by uuid references public.profiles (id) on delete set null,
  closed_by uuid references public.profiles (id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pos_order_items (
  id text primary key,
  order_id text not null references public.pos_orders (id) on delete cascade,
  product_id text references public.pos_products (id) on delete set null,
  product_name text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Payments / sales ledger
-- ---------------------------------------------------------------------------
create table if not exists public.pos_payments (
  id text primary key,
  order_id text not null references public.pos_orders (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null default 'cash'
    check (method in ('cash', 'card', 'gcash', 'maya', 'bank_transfer', 'room_charge', 'other')),
  reference_no text,
  note text,
  received_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists pos_products_category_idx
  on public.pos_products (category_id);
create index if not exists pos_products_active_idx
  on public.pos_products (is_active, is_quick_sell);
create index if not exists pos_orders_status_idx
  on public.pos_orders (status, opened_at desc);
create index if not exists pos_orders_opened_at_idx
  on public.pos_orders (opened_at desc);
create index if not exists pos_orders_table_idx
  on public.pos_orders (table_id);
create index if not exists pos_order_items_order_idx
  on public.pos_order_items (order_id);
create index if not exists pos_payments_order_idx
  on public.pos_payments (order_id);
create index if not exists pos_payments_created_idx
  on public.pos_payments (created_at desc);
create index if not exists pos_tables_status_idx
  on public.pos_tables (status, zone);

-- ---------------------------------------------------------------------------
-- Seed catalog (matches register quick-sell stub)
-- ---------------------------------------------------------------------------
insert into public.pos_categories (id, name, description, sort_order) values
  ('poscat_beverages', 'Beverages', 'Drinks and refreshments', 10),
  ('poscat_food', 'Food', 'Snacks and meals', 20),
  ('poscat_services', 'Services', 'Laundry and guest services', 30),
  ('poscat_retail', 'Retail', 'Merchandise and sundries', 40)
on conflict (id) do nothing;

insert into public.pos_products (
  id, category_id, sku, name, price, is_quick_sell, sort_order, track_stock, stock_qty
) values
  ('posprod_water', 'poscat_beverages', 'BEV-WATER', 'Bottled Water', 30.00, true, 10, true, 100),
  ('posprod_coffee', 'poscat_beverages', 'BEV-COFFEE', 'Coffee', 80.00, true, 20, false, 0),
  ('posprod_sandwich', 'poscat_food', 'FOOD-SNDW', 'Sandwich', 150.00, true, 10, false, 0),
  ('posprod_laundry', 'poscat_services', 'SVC-LAUNDRY', 'Laundry', 200.00, true, 10, false, 0)
on conflict (id) do nothing;

insert into public.pos_tables (id, name, zone, seats, status, sort_order) values
  ('postbl_1', 'T1', 'Dining', 4, 'available', 10),
  ('postbl_2', 'T2', 'Dining', 4, 'available', 20),
  ('postbl_3', 'T3', 'Dining', 6, 'available', 30),
  ('postbl_4', 'T4', 'Patio', 2, 'available', 40),
  ('postbl_5', 'Bar 1', 'Bar', 2, 'available', 50)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers: order number sequence
-- ---------------------------------------------------------------------------
create sequence if not exists public.pos_order_number_seq;

create or replace function public.next_pos_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  n := nextval('public.pos_order_number_seq');
  return 'POS-' || to_char(now(), 'YYMMDD') || '-' || lpad(n::text, 4, '0');
end;
$$;

grant usage, select on sequence public.pos_order_number_seq to authenticated;
grant execute on function public.next_pos_order_number() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pos_categories enable row level security;
alter table public.pos_products enable row level security;
alter table public.pos_tables enable row level security;
alter table public.pos_orders enable row level security;
alter table public.pos_order_items enable row level security;
alter table public.pos_payments enable row level security;

drop policy if exists "Authenticated all pos_categories" on public.pos_categories;
drop policy if exists "Authenticated all pos_products" on public.pos_products;
drop policy if exists "Authenticated all pos_tables" on public.pos_tables;
drop policy if exists "Authenticated all pos_orders" on public.pos_orders;
drop policy if exists "Authenticated all pos_order_items" on public.pos_order_items;
drop policy if exists "Authenticated all pos_payments" on public.pos_payments;

create policy "Authenticated all pos_categories" on public.pos_categories
  for all to authenticated using (true) with check (true);
create policy "Authenticated all pos_products" on public.pos_products
  for all to authenticated using (true) with check (true);
create policy "Authenticated all pos_tables" on public.pos_tables
  for all to authenticated using (true) with check (true);
create policy "Authenticated all pos_orders" on public.pos_orders
  for all to authenticated using (true) with check (true);
create policy "Authenticated all pos_order_items" on public.pos_order_items
  for all to authenticated using (true) with check (true);
create policy "Authenticated all pos_payments" on public.pos_payments
  for all to authenticated using (true) with check (true);
