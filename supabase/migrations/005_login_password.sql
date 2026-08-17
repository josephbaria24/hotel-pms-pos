-- Classroom plaintext login hint for instructors (not used for auth).
-- Auth still uses hashed passwords in auth.users.

alter table public.profiles
  add column if not exists login_password text;

comment on column public.profiles.login_password is
  'Classroom-only recoverable password for instructors. Auth uses auth.users hashes.';
