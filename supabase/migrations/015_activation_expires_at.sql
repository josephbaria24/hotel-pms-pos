-- Optional time-limited account activation (admin classroom)

alter table public.profiles
  add column if not exists activation_expires_at timestamptz;

comment on column public.profiles.activation_expires_at is
  'When set, the account is treated as inactive at/after this timestamp. Cleared on deactivate or unlimited activate.';

create index if not exists profiles_activation_expires_at_idx
  on public.profiles (activation_expires_at)
  where activation_expires_at is not null;

drop function if exists public.admin_classroom_overview();

create or replace function public.admin_classroom_overview()
returns table (
  id uuid,
  email text,
  full_name text,
  username text,
  role text,
  is_active boolean,
  onboarding_completed boolean,
  created_at timestamptz,
  activation_expires_at timestamptz,
  rooms_count bigint,
  guests_count bigint,
  reservations_count bigint,
  checkins_count bigint,
  payments_count bigint,
  pos_orders_count bigint,
  pos_paid_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.full_name,
    p.username,
    p.role,
    p.is_active,
    p.onboarding_completed,
    p.created_at,
    p.activation_expires_at,
    (select count(*) from public.rooms r where r.tenant_id = p.id),
    (select count(*) from public.guests g where g.tenant_id = p.id),
    (select count(*) from public.reservations res where res.tenant_id = p.id),
    (select count(*) from public.reservations res where res.tenant_id = p.id and res.status = 'checked_in'),
    (select count(*) from public.payments pay where pay.tenant_id = p.id),
    (select count(*) from public.pos_orders o where o.tenant_id = p.id),
    (select count(*) from public.pos_orders o where o.tenant_id = p.id and o.status = 'paid')
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.full_name;
end;
$$;

grant execute on function public.admin_classroom_overview() to authenticated;
