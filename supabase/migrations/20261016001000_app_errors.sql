-- Monitoring błędów aplikacji bez danych osobowych. Serwer Next.js (instrumentation.ts, /api/bledy) zapisuje
-- błędy zgrupowane po odcisku: rodzaj + wzorzec trasy + oczyszczony komunikat. Bez adresów IP, bez treści
-- formularzy, bez identyfikatorów z adresu. Baza czyści komunikat drugi raz (na wypadek błędu w aplikacji).
-- Przechowywanie: 30 dni od ostatniego wystąpienia (purge_old_data).

create table public.app_errors (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{32}$'),
  kind        text not null check (kind in ('serwer', 'przegladarka')),
  route       text not null check (length(route) <= 200),
  message     text not null check (length(message) <= 300),
  last_digest text check (last_digest ~ '^[A-Za-z0-9@:_-]{1,64}$'),
  count       int not null default 1,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index app_errors_last_seen on public.app_errors (last_seen desc);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;

create or replace function public.scrub_text(p text) returns text
language sql immutable set search_path = public as $$
  select left(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[e-mail]', 'g'),
    '\+?\d[\d\s-]{4,}\d', '[liczba]', 'g'),
    '\s+', ' ', 'g'), 300)
$$;

create or replace function public.log_app_error(p_fingerprint text, p_kind text, p_route text, p_message text, p_digest text)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  insert into app_errors (fingerprint, kind, route, message, last_digest)
  values (p_fingerprint, p_kind, left(scrub_text(p_route), 200), scrub_text(p_message), p_digest)
  on conflict (fingerprint) do update
  set count = app_errors.count + 1, last_seen = now(), last_digest = coalesce(excluded.last_digest, app_errors.last_digest);
end $$;

create or replace function public.admin_errors()
returns table (kind text, route text, message text, last_digest text, count int, first_seen timestamptz, last_seen timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select e.kind, e.route, e.message, e.last_digest, e.count, e.first_seen, e.last_seen
    from app_errors e where e.last_seen > now() - interval '30 days'
    order by e.last_seen desc limit 200;
end $$;

-- Retencja: jak w migracji 600, plus błędy aplikacji starsze niż 30 dni.
create or replace function public.purge_old_data() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_inq int;
  v_drafts int;
  v_audit int;
  v_errors int;
begin
  update inquiries set contact_name = 'usunięto', contact_phone = '000000000'
  where created_at < now() - interval '90 days' and contact_name <> 'usunięto';
  get diagnostics v_inq = row_count;
  delete from inquiry_drafts where created_at < now() - interval '1 day';
  get diagnostics v_drafts = row_count;
  delete from admin_audit where created_at < now() - interval '2 years';
  get diagnostics v_audit = row_count;
  delete from rate_limits where window_start < now() - interval '1 day';
  delete from app_errors where last_seen < now() - interval '30 days';
  get diagnostics v_errors = row_count;
  return jsonb_build_object('zapytania', v_inq, 'szkice', v_drafts, 'dziennik', v_audit, 'bledy', v_errors);
end $$;

revoke all on function public.scrub_text(text), public.log_app_error(text, text, text, text, text), public.admin_errors(),
  public.purge_old_data() from public, anon, authenticated;
grant execute on function public.log_app_error(text, text, text, text, text), public.purge_old_data() to service_role;
grant execute on function public.admin_errors() to authenticated;
