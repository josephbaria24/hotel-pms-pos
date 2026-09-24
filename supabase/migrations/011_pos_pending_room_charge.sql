-- Fix: drop existing status check by name, then recreate with "pending".
alter table public.pos_orders
  drop constraint if exists pos_orders_status_check;

do $$
declare
  con text;
begin
  select c.conname into con
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'pos_orders'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%status%'
  limit 1;
  if con is not null then
    execute format('alter table public.pos_orders drop constraint %I', con);
  end if;
end $$;

alter table public.pos_orders
  add constraint pos_orders_status_check
  check (status in ('open', 'held', 'pending', 'paid', 'void', 'refunded'));

-- Existing room charges closed as "paid" with ₱0 collected → pending until folio is settled.
update public.pos_orders
set status = 'pending',
    updated_at = now()
where order_type = 'room_charge'
  and status = 'paid'
  and coalesce(paid_amount, 0) < coalesce(total_amount, 0);
