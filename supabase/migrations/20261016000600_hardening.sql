-- Przegląd bezpieczeństwa (16.10.2026).
-- 1. Funkcje, które zwracają sekrety (kod SMS, e-mail z zaproszenia) albo omijają formularz, wywołuje tylko serwer
--    aplikacji w roli service_role. Supabase udostępnia funkcje roli anon przez publiczne API (klucz anon jest jawny),
--    więc z rolą anon dałoby się pobrać kod SMS bez telefonu.
-- 2. Funkcje bez jawnych uprawnień nie są wykonywalne dla wszystkich (domyślne EXECUTE dla PUBLIC).
-- 3. Limit prób w bazie zamiast w pamięci serwera (na Vercel każda instancja ma własną pamięć).

revoke execute on function public.start_inquiry(jsonb) from anon;
revoke execute on function public.resend_inquiry_code(uuid) from anon;
revoke execute on function public.confirm_inquiry(uuid, text) from anon;
revoke execute on function public.draft_info(uuid) from anon;
revoke execute on function public.invitation_email(text) from anon;
revoke execute on function public.accept_invitation(text, uuid) from anon;
grant execute on function public.start_inquiry(jsonb) to service_role;
grant execute on function public.resend_inquiry_code(uuid) to service_role;
grant execute on function public.confirm_inquiry(uuid, text) to service_role;
grant execute on function public.draft_info(uuid) to service_role;
grant execute on function public.invitation_email(text) to service_role;
grant execute on function public.accept_invitation(text, uuid) to service_role;

-- Wycena dowolnego zakładu (także niezweryfikowanego) – tylko dla zalogowanych; rodziny dostają ją przez search_homes.
revoke all on function public.quote_for(uuid, burial_type, ceremony_type) from public;
grant execute on function public.quote_for(uuid, burial_type, ceremony_type) to authenticated, service_role;
revoke all on function public.notify_new_offer() from public;
revoke all on function public.distance_km(double precision, double precision, double precision, double precision) from public;
grant execute on function public.distance_km(double precision, double precision, double precision, double precision) to anon, authenticated, service_role;
revoke all on function public.search_homes(text, burial_type, ceremony_type, text) from public;
grant execute on function public.search_homes(text, burial_type, ceremony_type, text) to anon, authenticated, service_role;
revoke all on function public.home_price_list(uuid, burial_type, ceremony_type) from public;
grant execute on function public.home_price_list(uuid, burial_type, ceremony_type) to anon, authenticated, service_role;

-- Limit prób: klucz to skrót (rodzaj akcji + adres IP) – sam adres IP nie trafia do bazy.
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;

create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_s int) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s);
  v_hits int;
begin
  delete from rate_limits where window_start < now() - interval '1 day';
  insert into rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke all on function public.hit_rate_limit(text, int, int) from public;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- Serwer (service_role) korzysta też z funkcji publicznych.
grant execute on function public.invitation_preview(text) to service_role;
grant execute on function public.family_get_order(text) to service_role;
grant execute on function public.public_memorial(text) to service_role;

-- Retencja (polityka prywatności, rozdz. „Jak długo”): dane kontaktowe z zapytań usuwamy po 90 dniach.
-- Zlecenie przyjęte przez zakład ma własną kopię danych osoby organizującej – tę przechowuje zakład.
create or replace function public.purge_old_data() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_inq int;
  v_drafts int;
  v_audit int;
begin
  update inquiries set contact_name = 'usunięto', contact_phone = '000000000'
  where created_at < now() - interval '90 days' and contact_name <> 'usunięto';
  get diagnostics v_inq = row_count;
  delete from inquiry_drafts where created_at < now() - interval '1 day';
  get diagnostics v_drafts = row_count;
  delete from admin_audit where created_at < now() - interval '2 years';
  get diagnostics v_audit = row_count;
  delete from rate_limits where window_start < now() - interval '1 day';
  return jsonb_build_object('zapytania', v_inq, 'szkice', v_drafts, 'dziennik', v_audit);
end $$;
revoke all on function public.purge_old_data() from public;
grant execute on function public.purge_old_data() to service_role;
