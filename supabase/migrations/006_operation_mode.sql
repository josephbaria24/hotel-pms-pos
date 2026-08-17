-- Operation mode: lab (isolated student progress + shared admin rooms)
--              vs shared (real hotel — everyone sees all data)
-- Run after 004_onboarding_admin.sql (and 005 if used)

create table if not exists public.app_config (
  id integer primary key default 1 check (id = 1),
  operation_mode text not null default 'lab'
    check (operation_mode = any (array['lab'::text, 'shared'::text])),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.app_config (id, operation_mode)
values (1, 'lab')
on conflict (id) do nothing;

alter table public.app_config enable row level security;

drop policy if exists "app_config read" on public.app_config;
drop policy if exists "app_config update" on public.app_config;

create policy "app_config read" on public.app_config
  for select to authenticated
  using (true);

create policy "app_config update" on public.app_config
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.is_shared_mode()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.operation_mode = 'shared' from public.app_config c where c.id = 1),
    false
  );
$$;

create or replace function public.tenant_is_admin(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_tenant
      and p.role = 'admin'
  );
$$;

-- Progress rows: own only in lab; everyone in shared
create or replace function public.can_access_progress(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_shared_mode() or p_tenant = auth.uid();
$$;

-- Catalog / rooms: own + admin-owned in lab (so students see admin rooms); everyone in shared
create or replace function public.can_access_catalog(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_shared_mode()
      or p_tenant = auth.uid()
      or public.tenant_is_admin(p_tenant);
$$;

grant execute on function public.is_shared_mode() to authenticated;
grant execute on function public.tenant_is_admin(uuid) to authenticated;
grant execute on function public.can_access_progress(uuid) to authenticated;
grant execute on function public.can_access_catalog(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Replace tenant RLS policies
-- ---------------------------------------------------------------------------

-- Progress tables
drop policy if exists "tenant guests" on public.guests;
drop policy if exists "tenant reservations" on public.reservations;
drop policy if exists "tenant payments" on public.payments;
drop policy if exists "tenant activity_logs" on public.activity_logs;
drop policy if exists "tenant pos_orders" on public.pos_orders;
drop policy if exists "tenant pos_order_items" on public.pos_order_items;
drop policy if exists "tenant pos_payments" on public.pos_payments;

create policy "mode guests" on public.guests
  for all to authenticated
  using (public.can_access_progress(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode());

create policy "mode reservations" on public.reservations
  for all to authenticated
  using (public.can_access_progress(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode());

create policy "mode payments" on public.payments
  for all to authenticated
  using (public.can_access_progress(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode());

create policy "mode activity_logs" on public.activity_logs
  for all to authenticated
  using (public.can_access_progress(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode());

create policy "mode pos_orders" on public.pos_orders
  for all to authenticated
  using (public.can_access_progress(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode());

create policy "mode pos_order_items" on public.pos_order_items
  for all to authenticated
  using (public.can_access_progress(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode());

create policy "mode pos_payments" on public.pos_payments
  for all to authenticated
  using (public.can_access_progress(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode());

-- Catalog / inventory (rooms + options + POS menu + settings + housekeepers)
drop policy if exists "tenant rooms" on public.rooms;
drop policy if exists "tenant room_type_options" on public.room_type_options;
drop policy if exists "tenant room_status_options" on public.room_status_options;
drop policy if exists "tenant housekeepers" on public.housekeepers;
drop policy if exists "tenant settings" on public.settings;
drop policy if exists "tenant pos_categories" on public.pos_categories;
drop policy if exists "tenant pos_products" on public.pos_products;
drop policy if exists "tenant pos_tables" on public.pos_tables;

-- Rooms: students can read/update admin rooms (status for check-in);
-- inserts still belong to the acting user (trigger sets tenant_id).
create policy "mode rooms select" on public.rooms
  for select to authenticated
  using (public.can_access_catalog(tenant_id));

create policy "mode rooms insert" on public.rooms
  for insert to authenticated
  with check (tenant_id = auth.uid() or public.is_shared_mode());

create policy "mode rooms update" on public.rooms
  for update to authenticated
  using (public.can_access_catalog(tenant_id))
  with check (public.can_access_catalog(tenant_id));

create policy "mode rooms delete" on public.rooms
  for delete to authenticated
  using (
    public.is_shared_mode()
    or tenant_id = auth.uid()
    or public.is_admin()
  );

create policy "mode room_type_options" on public.room_type_options
  for all to authenticated
  using (public.can_access_catalog(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode() or public.is_admin());

create policy "mode room_status_options" on public.room_status_options
  for all to authenticated
  using (public.can_access_catalog(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode() or public.is_admin());

create policy "mode housekeepers" on public.housekeepers
  for all to authenticated
  using (public.can_access_catalog(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode() or public.is_admin());

-- Settings stay personal in lab (own hotel name), shared in real mode
create policy "mode settings" on public.settings
  for all to authenticated
  using (public.can_access_progress(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode());

create policy "mode pos_categories" on public.pos_categories
  for all to authenticated
  using (public.can_access_catalog(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode() or public.is_admin());

create policy "mode pos_products" on public.pos_products
  for all to authenticated
  using (public.can_access_catalog(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode() or public.is_admin());

create policy "mode pos_tables" on public.pos_tables
  for all to authenticated
  using (public.can_access_catalog(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode() or public.is_admin());

create or replace function public.set_app_operation_mode(p_mode text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_mode not in ('lab', 'shared') then
    raise exception 'Invalid mode';
  end if;

  insert into public.app_config (id, operation_mode, updated_at, updated_by)
  values (1, p_mode, now(), auth.uid())
  on conflict (id) do update
    set operation_mode = excluded.operation_mode,
        updated_at = now(),
        updated_by = auth.uid();

  return p_mode;
end;
$$;

grant execute on function public.set_app_operation_mode(text) to authenticated;

-- Allow same room numbers per tenant (lab isolation + shared admin catalog)
alter table public.rooms drop constraint if exists rooms_room_number_key;
create unique index if not exists rooms_tenant_room_number_uidx
  on public.rooms (tenant_id, room_number);

-- In lab mode, starter rooms are only seeded for admins so students use shared admin rooms.
create or replace function public.seed_tenant_defaults(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = p_tenant;

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

  -- Shared room inventory comes from admin accounts in lab mode
  if v_role = 'admin' then
    insert into public.rooms (
      id, tenant_id, room_number, type, floor, capacity, rate, status, condition
    )
    values
      (p_tenant::text || '_rm_101', p_tenant, '101', 'single', '1', 1, 1200, 'available', 'clean'),
      (p_tenant::text || '_rm_102', p_tenant, '102', 'double', '1', 2, 1800, 'available', 'clean'),
      (p_tenant::text || '_rm_201', p_tenant, '201', 'deluxe', '2', 2, 2500, 'available', 'clean'),
      (p_tenant::text || '_rm_301', p_tenant, '301', 'suite', '3', 4, 4500, 'available', 'clean')
    on conflict do nothing;
  end if;
end;
$$;

