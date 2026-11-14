-- Fix staff room-create failures: room numbers must be unique per tenant, not globally.
-- Lab mode lets every student use the same numbers (101, 102, …) as admin/other accounts.
-- If rooms_room_number_key (or similar) is still present, inserts collide across tenants.

do $$
declare
  r record;
begin
  -- Drop UNIQUE constraints on rooms.room_number that do not include tenant_id
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'rooms'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%room_number%'
      and pg_get_constraintdef(c.oid) not ilike '%tenant_id%'
  loop
    execute format('alter table public.rooms drop constraint if exists %I', r.conname);
  end loop;

  -- Drop UNIQUE indexes on rooms.room_number alone (not composite with tenant_id)
  for r in
    select i.relname as index_name
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'rooms'
      and x.indisunique
      and not x.indisprimary
      and array_length(x.indkey, 1) = 1
      and exists (
        select 1
        from pg_attribute a
        where a.attrelid = t.oid
          and a.attnum = x.indkey[0]
          and a.attname = 'room_number'
      )
  loop
    execute format('drop index if exists public.%I', r.index_name);
  end loop;
end $$;

-- Same class of bug for reservation numbers across lab tenants
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'reservations'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%reservation_number%'
      and pg_get_constraintdef(c.oid) not ilike '%tenant_id%'
  loop
    execute format('alter table public.reservations drop constraint if exists %I', r.conname);
  end loop;

  for r in
    select i.relname as index_name
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'reservations'
      and x.indisunique
      and not x.indisprimary
      and array_length(x.indkey, 1) = 1
      and exists (
        select 1
        from pg_attribute a
        where a.attrelid = t.oid
          and a.attnum = x.indkey[0]
          and a.attname = 'reservation_number'
      )
  loop
    execute format('drop index if exists public.%I', r.index_name);
  end loop;
end $$;

create unique index if not exists rooms_tenant_room_number_uidx
  on public.rooms (tenant_id, room_number);

create unique index if not exists reservations_tenant_reservation_number_uidx
  on public.reservations (tenant_id, reservation_number);

-- Ensure insert trigger always stamps tenant_id (needed for RLS with check)
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

drop trigger if exists set_tenant_id_trg on public.rooms;
create trigger set_tenant_id_trg
  before insert on public.rooms
  for each row execute function public.set_row_tenant_id();
