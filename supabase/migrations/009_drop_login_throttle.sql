-- Remove login rate limiting. Session nonce (single active session) stays.

drop function if exists public.login_guard_success(text);
drop function if exists public.login_guard_fail(text, text);
drop function if exists public.login_guard_status(text, text);
drop function if exists public._login_guard_bump(text, integer, interval, interval, timestamptz);
drop table if exists public.login_throttle;
