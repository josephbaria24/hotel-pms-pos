-- Housekeeping room conditions (Clean, Dirty, plus admin-defined values)
-- Run after 006_operation_mode.sql

create table if not exists public.room_condition_options (
  id text primary key,
  value text not null,
  tenant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists room_condition_options_tenant_value_uidx
  on public.room_condition_options (tenant_id, value);

create index if not exists room_condition_options_tenant_idx
  on public.room_condition_options (tenant_id);

drop trigger if exists set_tenant_id_trg on public.room_condition_options;
create trigger set_tenant_id_trg
  before insert on public.room_condition_options
  for each row execute function public.set_row_tenant_id();

alter table public.room_condition_options enable row level security;

drop policy if exists "mode room_condition_options" on public.room_condition_options;
create policy "mode room_condition_options" on public.room_condition_options
  for all to authenticated
  using (public.can_access_catalog(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode() or public.is_admin());

-- Seed built-in conditions for existing tenants
insert into public.room_condition_options (id, tenant_id, value)
select p.id::text || '_cond_clean', p.id, 'clean'
from public.profiles p
on conflict do nothing;

insert into public.room_condition_options (id, tenant_id, value)
select p.id::text || '_cond_dirty', p.id, 'dirty'
from public.profiles p
on conflict do nothing;

-- Keep new tenants in sync with catalog seeding
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

  insert into public.room_condition_options (id, tenant_id, value)
  values
    (p_tenant::text || '_cond_clean', p_tenant, 'clean'),
    (p_tenant::text || '_cond_dirty', p_tenant, 'dirty')
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
