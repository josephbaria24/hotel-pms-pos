-- Login rate limits + single active session per account
-- Run after 007_room_condition_options.sql

alter table public.profiles
  add column if not exists session_nonce text;

create table if not exists public.login_throttle (
  throttle_key text primary key,
  fail_count integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.login_throttle enable row level security;

revoke all on public.login_throttle from anon, authenticated, public;

create or replace function public._login_guard_bump(
  p_key text,
  p_max integer,
  p_window interval,
  p_lock interval,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.login_throttle%rowtype;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  select * into r from public.login_throttle where throttle_key = p_key for update;

  if not found then
    insert into public.login_throttle (throttle_key, fail_count, window_start, locked_until)
    values (p_key, 1, p_now, null);
    return;
  end if;

  if r.locked_until is not null and r.locked_until > p_now then
    return;
  end if;

  if r.window_start < p_now - p_window then
    v_count := 1;
    update public.login_throttle
    set fail_count = 1,
        window_start = p_now,
        locked_until = null
    where throttle_key = p_key;
  else
    v_count := r.fail_count + 1;
    update public.login_throttle
    set fail_count = v_count,
        locked_until = case when v_count >= p_max then p_now + p_lock else null end
    where throttle_key = p_key;
  end if;
end;
$$;

create or replace function public.login_guard_status(p_email text, p_ip text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_email_key text := 'email:' || lower(trim(coalesce(p_email, '')));
  v_ip_key text := 'ip:' || coalesce(nullif(trim(p_ip), ''), 'unknown');
  v_email public.login_throttle%rowtype;
  v_ip public.login_throttle%rowtype;
begin
  select * into v_email from public.login_throttle where throttle_key = v_email_key;
  select * into v_ip from public.login_throttle where throttle_key = v_ip_key;

  if v_email.locked_until is not null and v_email.locked_until > v_now then
    return jsonb_build_object(
      'allowed', false,
      'retry_after', greatest(1, ceil(extract(epoch from (v_email.locked_until - v_now)))),
      'reason', 'email'
    );
  end if;

  if v_ip.locked_until is not null and v_ip.locked_until > v_now then
    return jsonb_build_object(
      'allowed', false,
      'retry_after', greatest(1, ceil(extract(epoch from (v_ip.locked_until - v_now)))),
      'reason', 'ip'
    );
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

create or replace function public.login_guard_fail(p_email text, p_ip text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window interval := interval '15 minutes';
  v_lock interval := interval '15 minutes';
  v_email_key text := 'email:' || lower(trim(coalesce(p_email, '')));
  v_ip_key text := 'ip:' || coalesce(nullif(trim(p_ip), ''), 'unknown');
begin
  perform public._login_guard_bump(v_email_key, 5, v_window, v_lock, v_now);
  perform public._login_guard_bump(v_ip_key, 30, v_window, v_lock, v_now);
  return public.login_guard_status(p_email, p_ip);
end;
$$;

create or replace function public.login_guard_success(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.login_throttle
  where throttle_key = 'email:' || lower(trim(coalesce(p_email, '')));
end;
$$;

revoke all on function public._login_guard_bump(text, integer, interval, interval, timestamptz) from public, anon, authenticated;
grant execute on function public.login_guard_status(text, text) to anon, authenticated;
grant execute on function public.login_guard_fail(text, text) to anon, authenticated;
grant execute on function public.login_guard_success(text) to anon, authenticated;

do $$
begin
  execute 'alter publication supabase_realtime add table public.profiles';
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
