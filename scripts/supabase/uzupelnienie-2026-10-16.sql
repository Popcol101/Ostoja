-- Ostoja – uzupełnienie wersji testowej 16.10.2026 (uruchom RAZ w Supabase → SQL Editor).
-- Dwie funkcje z migracji 1000 i 1100, których konektor nie wgrał, bo zawierają „delete” (retencja i usunięcie
-- danych na wniosek osoby). Pozostałe części tych migracji są już w bazie. Plik niczego nie usuwa przy uruchomieniu –
-- tylko definiuje funkcje. Na końcu przenosi rozszerzenie pg_net ze schematu public do extensions
-- (uwaga doradcy bezpieczeństwa; zadanie harmonogramu wywołuje net.http_post i działa dalej).

begin;

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


-- Usunięcie danych Ostoi o osobie (art. 17): imię i telefon w zapytaniach oraz szkice. Zlecenia zostają u zakładu.
create or replace function public.admin_subject_erase(p_phone text) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  v text;
  n int;
begin
  perform assert_platform_admin();
  v := subject_phone(p_phone);
  update inquiries set contact_name = 'usunięto', contact_phone = '000000000'
  where phone_digits(contact_phone) = v and contact_name <> 'usunięto';
  get diagnostics n = row_count;
  delete from inquiry_drafts where phone_digits(phone) = v;
  perform admin_log('wniosek RODO – usunięcie', 'tel. …' || right(v, 3) || ', zapytań: ' || n);
  return n;
end $$;


revoke all on function public.purge_old_data(), public.admin_subject_erase(text) from public, anon, authenticated;
grant execute on function public.purge_old_data() to service_role;
grant execute on function public.admin_subject_erase(text) to authenticated;

commit;

-- pg_net nie da się przenieść poleceniem ALTER, więc instalujemy je od nowa w schemacie extensions.
-- Kolejka wysyłek pg_net jest pusta poza chwilą wywołania harmonogramu (co minutę) – nic ważnego nie ginie.
drop extension if exists pg_net;
create extension pg_net schema extensions;

-- Sprawdzenie: powinny być dwa wiersze.
select proname from pg_proc where proname in ('purge_old_data', 'admin_subject_erase') and pronamespace = 'public'::regnamespace;
select extname, extnamespace::regnamespace from pg_extension where extname = 'pg_net';
