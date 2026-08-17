-- Per-student / per-user data isolation for classroom use
-- Each auth user gets their own tenant_id (= their user id)
-- Run in Supabase SQL Editor after 001 + 002

-- ---------------------------------------------------------------------------
-- Add tenant_id columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists tenant_id uuid;

update public.profiles set tenant_id = id where tenant_id is null;

alter table public.rooms add column if not exists tenant_id uuid;
alter table public.guests add column if not exists tenant_id uuid;
alter table public.reservations add column if not exists tenant_id uuid;
alter table public.payments add column if not exists tenant_id uuid;
alter table public.activity_logs add column if not exists tenant_id uuid;
alter table public.settings add column if not exists tenant_id uuid;
alter table public.housekeepers add column if not exists tenant_id uuid;
alter table public.room_type_options add column if not exists tenant_id uuid;
alter table public.room_status_options add column if not exists tenant_id uuid;

alter table public.pos_categories add column if not exists tenant_id uuid;
alter table public.pos_products add column if not exists tenant_id uuid;
alter table public.pos_tables add column if not exists tenant_id uuid;
alter table public.pos_orders add column if not exists tenant_id uuid;
alter table public.pos_order_items add column if not exists tenant_id uuid;
alter table public.pos_payments add column if not exists tenant_id uuid;

-- Unique option values per tenant (drop global unique if present)
alter table public.room_type_options drop constraint if exists room_type_options_value_key;
alter table public.room_status_options drop constraint if exists room_status_options_value_key;
create unique index if not exists room_type_options_tenant_value_uidx
  on public.room_type_options (tenant_id, value);
create unique index if not exists room_status_options_tenant_value_uidx
  on public.room_status_options (tenant_id, value);

-- Settings: one row per tenant (id remains text; prefer id = tenant uuid text)
create unique index if not exists settings_tenant_uidx on public.settings (tenant_id);

-- POS unique names per tenant
alter table public.pos_categories drop constraint if exists pos_categories_name_key;
create unique index if not exists pos_categories_tenant_name_uidx
  on public.pos_categories (tenant_id, name);
alter table public.pos_tables drop constraint if exists pos_tables_name_key;
create unique index if not exists pos_tables_tenant_name_uidx
  on public.pos_tables (tenant_id, name);
alter table public.pos_products drop constraint if exists pos_products_sku_key;
create unique index if not exists pos_products_tenant_sku_uidx
  on public.pos_products (tenant_id, sku) where sku is not null;

create index if not exists rooms_tenant_idx on public.rooms (tenant_id);
create index if not exists guests_tenant_idx on public.guests (tenant_id);
create index if not exists reservations_tenant_idx on public.reservations (tenant_id);
create index if not exists payments_tenant_idx on public.payments (tenant_id);
create index if not exists pos_orders_tenant_idx on public.pos_orders (tenant_id);

-- ---------------------------------------------------------------------------
-- Auto-set tenant_id = auth.uid() on insert
-- ---------------------------------------------------------------------------
create or replace function public.set_row_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is null then
    new.tenant_id := auth.uid();
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'rooms','guests','reservations','payments','activity_logs','settings',
    'housekeepers','room_type_options','room_status_options',
    'pos_categories','pos_products','pos_tables','pos_orders',
    'pos_order_items','pos_payments'
  ]
  loop
    execute format('drop trigger if exists set_tenant_id_trg on public.%I', t);
    execute format(
      'create trigger set_tenant_id_trg before insert on public.%I
       for each row execute function public.set_row_tenant_id()',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Seed starter catalog for a new student tenant
-- ---------------------------------------------------------------------------
create or replace function public.seed_tenant_defaults(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (id, tenant_id, hotel_name, address, contact_number, currency)
  values (
    p_tenant::text,
    p_tenant,
    'PalawanSU Hotel',
    'Palawan State University Roxas Campus',
    '',
    'Peso'
  )
  on conflict (id) do nothing;

  insert into public.room_type_options (id, tenant_id, value)
  values
    (p_tenant::text || '_type_single', p_tenant, 'single'),
    (p_tenant::text || '_type_double', p_tenant, 'double'),
    (p_tenant::text || '_type_deluxe', p_tenant, 'deluxe'),
    (p_tenant::text || '_type_suite', p_tenant, 'suite'),
    (p_tenant::text || '_type_family', p_tenant, 'family')
  on conflict do nothing;

  insert into public.room_status_options (id, tenant_id, value, disables_room)
  values
    (p_tenant::text || '_st_available', p_tenant, 'available', false),
    (p_tenant::text || '_st_occupied', p_tenant, 'occupied', false),
    (p_tenant::text || '_st_cleaning', p_tenant, 'cleaning', true),
    (p_tenant::text || '_st_maintenance', p_tenant, 'maintenance', true)
  on conflict do nothing;

  insert into public.pos_categories (id, tenant_id, name, description, sort_order)
  values
    (p_tenant::text || '_poscat_bev', p_tenant, 'Beverages', 'Drinks and refreshments', 10),
    (p_tenant::text || '_poscat_food', p_tenant, 'Food', 'Snacks and meals', 20),
    (p_tenant::text || '_poscat_svc', p_tenant, 'Services', 'Guest services', 30)
  on conflict do nothing;

  insert into public.pos_products (
    id, tenant_id, category_id, sku, name, price, is_quick_sell, sort_order, track_stock, stock_qty
  )
  values
    (p_tenant::text || '_prod_water', p_tenant, p_tenant::text || '_poscat_bev', 'BEV-WATER', 'Bottled Water', 30, true, 10, true, 50),
    (p_tenant::text || '_prod_coffee', p_tenant, p_tenant::text || '_poscat_bev', 'BEV-COFFEE', 'Coffee', 80, true, 20, false, 0),
    (p_tenant::text || '_prod_sandwich', p_tenant, p_tenant::text || '_poscat_food', 'FOOD-SNDW', 'Sandwich', 150, true, 10, false, 0),
    (p_tenant::text || '_prod_laundry', p_tenant, p_tenant::text || '_poscat_svc', 'SVC-LAUNDRY', 'Laundry', 200, true, 10, false, 0)
  on conflict do nothing;

  insert into public.pos_tables (id, tenant_id, name, zone, seats, status, sort_order)
  values
    (p_tenant::text || '_tbl_1', p_tenant, 'T1', 'Dining', 4, 'available', 10),
    (p_tenant::text || '_tbl_2', p_tenant, 'T2', 'Dining', 4, 'available', 20),
    (p_tenant::text || '_tbl_3', p_tenant, 'T3', 'Patio', 2, 'available', 30)
  on conflict do nothing;

  -- Starter rooms so lessons can begin immediately
  insert into public.rooms (
    id, tenant_id, room_number, type, floor, capacity, rate, status, condition
  )
  values
    (p_tenant::text || '_rm_101', p_tenant, '101', 'single', '1', 1, 1200, 'available', 'clean'),
    (p_tenant::text || '_rm_102', p_tenant, '102', 'double', '1', 2, 1800, 'available', 'clean'),
    (p_tenant::text || '_rm_201', p_tenant, '201', 'deluxe', '2', 2, 2500, 'available', 'clean'),
    (p_tenant::text || '_rm_301', p_tenant, '301', 'suite', '3', 4, 4500, 'available', 'clean')
  on conflict do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, tenant_id, username, full_name, role)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  )
  on conflict (id) do update
    set tenant_id = coalesce(public.profiles.tenant_id, excluded.tenant_id),
        full_name = excluded.full_name,
        username = coalesce(excluded.username, public.profiles.username),
        role = coalesce(excluded.role, public.profiles.role);

  perform public.seed_tenant_defaults(new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: each user only sees their own tenant data
-- ---------------------------------------------------------------------------
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
drop policy if exists "Authenticated all pos_categories" on public.pos_categories;
drop policy if exists "Authenticated all pos_products" on public.pos_products;
drop policy if exists "Authenticated all pos_tables" on public.pos_tables;
drop policy if exists "Authenticated all pos_orders" on public.pos_orders;
drop policy if exists "Authenticated all pos_order_items" on public.pos_order_items;
drop policy if exists "Authenticated all pos_payments" on public.pos_payments;

drop policy if exists "tenant read own profile" on public.profiles;
drop policy if exists "tenant update own profile" on public.profiles;
drop policy if exists "tenant rooms" on public.rooms;
drop policy if exists "tenant guests" on public.guests;
drop policy if exists "tenant reservations" on public.reservations;
drop policy if exists "tenant payments" on public.payments;
drop policy if exists "tenant activity_logs" on public.activity_logs;
drop policy if exists "tenant settings" on public.settings;
drop policy if exists "tenant housekeepers" on public.housekeepers;
drop policy if exists "tenant room_type_options" on public.room_type_options;
drop policy if exists "tenant room_status_options" on public.room_status_options;
drop policy if exists "tenant pos_categories" on public.pos_categories;
drop policy if exists "tenant pos_products" on public.pos_products;
drop policy if exists "tenant pos_tables" on public.pos_tables;
drop policy if exists "tenant pos_orders" on public.pos_orders;
drop policy if exists "tenant pos_order_items" on public.pos_order_items;
drop policy if exists "tenant pos_payments" on public.pos_payments;

create policy "tenant read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "tenant update own profile" on public.profiles
  for update to authenticated using (id = auth.uid());

create policy "tenant rooms" on public.rooms
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant guests" on public.guests
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant reservations" on public.reservations
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant payments" on public.payments
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant activity_logs" on public.activity_logs
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant settings" on public.settings
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant housekeepers" on public.housekeepers
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant room_type_options" on public.room_type_options
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant room_status_options" on public.room_status_options
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant pos_categories" on public.pos_categories
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant pos_products" on public.pos_products
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant pos_tables" on public.pos_tables
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant pos_orders" on public.pos_orders
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant pos_order_items" on public.pos_order_items
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy "tenant pos_payments" on public.pos_payments
  for all to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- Backfill existing users' starter data (safe if already seeded)
do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    perform public.seed_tenant_defaults(r.id);
  end loop;
end $$;
