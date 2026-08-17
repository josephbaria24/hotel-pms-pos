-- Onboarding flag, admin helpers, classroom progress RPC
-- Run after 003_student_tenancy.sql

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  assigned_role := case
    when lower(coalesce(new.email, '')) in (
      'sisorleimos@gmail.com',
      'josephbaria89@gmail.com'
    ) then 'admin'
    else coalesce(new.raw_user_meta_data->>'role', 'staff')
  end;

  insert into public.profiles (id, tenant_id, username, full_name, role, onboarding_completed)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    assigned_role,
    false
  )
  on conflict (id) do update
    set tenant_id = coalesce(public.profiles.tenant_id, excluded.tenant_id),
        full_name = excluded.full_name,
        username = coalesce(excluded.username, public.profiles.username),
        role = case
          when public.profiles.role = 'admin' then 'admin'
          else excluded.role
        end;

  perform public.seed_tenant_defaults(new.id);
  return new;
end;
$$;

update public.profiles p
set role = 'admin',
    updated_at = now()
from auth.users u
where u.id = p.id
  and lower(u.email) in ('sisorleimos@gmail.com', 'josephbaria89@gmail.com');

drop policy if exists "tenant read own profile" on public.profiles;
drop policy if exists "tenant update own profile" on public.profiles;
drop policy if exists "profiles select" on public.profiles;
drop policy if exists "profiles update" on public.profiles;

create policy "profiles select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

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
