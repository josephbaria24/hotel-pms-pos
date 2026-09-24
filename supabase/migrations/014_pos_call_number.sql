-- POS counter call numbers (short numbers staff shout when order is ready)
-- Run after 002 / 003 / 006 / 011

alter table public.pos_orders
  add column if not exists call_number integer;

create index if not exists pos_orders_call_number_idx
  on public.pos_orders (tenant_id, opened_at desc, call_number)
  where call_number is not null;

create table if not exists public.pos_call_number_counters (
  scope_id uuid not null,
  day date not null,
  last_number integer not null default 0,
  primary key (scope_id, day)
);

alter table public.pos_call_number_counters enable row level security;

drop policy if exists "pos call number counters admin" on public.pos_call_number_counters;
create policy "pos call number counters admin" on public.pos_call_number_counters
  for all to authenticated
  using (public.is_admin() or scope_id = auth.uid() or public.is_shared_mode())
  with check (public.is_admin() or scope_id = auth.uid() or public.is_shared_mode());

grant select, insert, update on public.pos_call_number_counters to authenticated;
grant all on public.pos_call_number_counters to service_role;

-- Next call number for today (PH time). Shared mode = one hotel-wide sequence.
create or replace function public.next_pos_call_number()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope uuid;
  v_day date;
  v_next integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_scope := case
    when public.is_shared_mode() then '00000000-0000-0000-0000-000000000001'::uuid
    else auth.uid()
  end;
  v_day := (timezone('Asia/Manila', now()))::date;

  insert into public.pos_call_number_counters (scope_id, day, last_number)
  values (v_scope, v_day, 1)
  on conflict (scope_id, day)
  do update set last_number = public.pos_call_number_counters.last_number + 1
  returning last_number into v_next;

  return v_next;
end;
$$;

grant execute on function public.next_pos_call_number() to authenticated;
