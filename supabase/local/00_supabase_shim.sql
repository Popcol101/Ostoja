-- Lokalna nakładka odtwarzająca to, czego Ostoja używa z Supabase.
-- NIE wykonuj tego pliku na projekcie Supabase: tam schemat auth, role i auth.uid() już istnieją.
-- Używane tylko przez scripts/db-reset.sh do testów na zwykłym PostgreSQL.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists auth;

-- Jak w Supabase: rozszerzenia w schemacie extensions, ścieżka wyszukiwania z extensions.
create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
do $$ begin
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
end $$;
set search_path = "$user", public, extensions;

-- Jak w Supabase: nowe tabele i funkcje w public dostają uprawnienia dla anon, authenticated i service_role.
-- Dlatego każda migracja musi jawnie odbierać to, czego nie chcemy udostępniać (test 09_hardening to sprawdza).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table if not exists auth.users (
  id                 uuid primary key,
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Ta sama definicja co w Supabase: najpierw stary klucz request.jwt.claim.sub, potem JSON z claims.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
-- Bez bezpośredniego dostępu do auth.users dla ról API – jak w Supabase. Aplikacja czyta konta przez funkcje security definer.
