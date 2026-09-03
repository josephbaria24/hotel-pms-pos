-- POS inventory: reorder points + stock movement ledger
-- Run in Supabase SQL Editor after 002 / 003 / 006

alter table public.pos_products
  add column if not exists reorder_point numeric(12, 3) not null default 5;

create table if not exists public.pos_stock_movements (
  id text primary key,
  tenant_id uuid,
  product_id text not null references public.pos_products (id) on delete cascade,
  type text not null
    check (type in ('receive', 'adjust', 'count', 'sale', 'void_sale', 'waste')),
  quantity numeric(12, 3) not null,
  qty_before numeric(12, 3) not null default 0,
  qty_after numeric(12, 3) not null default 0,
  reason text,
  reference_no text,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pos_stock_movements_product_idx
  on public.pos_stock_movements (product_id, created_at desc);
create index if not exists pos_stock_movements_tenant_idx
  on public.pos_stock_movements (tenant_id, created_at desc);
create index if not exists pos_stock_movements_type_idx
  on public.pos_stock_movements (type, created_at desc);

drop trigger if exists set_tenant_id_trg on public.pos_stock_movements;
create trigger set_tenant_id_trg
  before insert on public.pos_stock_movements
  for each row execute function public.set_row_tenant_id();

alter table public.pos_stock_movements enable row level security;

drop policy if exists "Authenticated all pos_stock_movements" on public.pos_stock_movements;
drop policy if exists "mode pos_stock_movements" on public.pos_stock_movements;

create policy "mode pos_stock_movements" on public.pos_stock_movements
  for all to authenticated
  using (public.can_access_catalog(tenant_id))
  with check (tenant_id = auth.uid() or public.is_shared_mode() or public.is_admin());

grant select, insert, update, delete on public.pos_stock_movements to authenticated;
grant all on public.pos_stock_movements to service_role;
