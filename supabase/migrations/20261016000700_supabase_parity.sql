-- Zgodność z domyślnymi uprawnieniami Supabase.
-- Supabase nadaje rolom anon i authenticated uprawnienia do KAŻDEJ nowej tabeli i funkcji w schemacie public
-- (ALTER DEFAULT PRIVILEGES). Odebranie uprawnień tylko roli PUBLIC nie wystarcza – funkcje typu
-- purge_old_data czy start_inquiry byłyby dostępne przez publiczne API. Ta migracja:
--   1) wyłącza te domyślne uprawnienia na przyszłość,
--   2) odbiera wszystko i nadaje jawnie tylko to, czego potrzebuje aplikacja.
-- Lokalna nakładka (supabase/local/00_supabase_shim.sql) odtwarza zachowanie Supabase, a test 09_hardening je sprawdza.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Funkcje -------------------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Strona dla rodzin (bez logowania).
grant execute on function public.search_homes(text, burial_type, ceremony_type, text) to anon, authenticated;
grant execute on function public.home_price_list(uuid, burial_type, ceremony_type) to anon, authenticated;
grant execute on function public.family_get_order(text) to anon, authenticated;
grant execute on function public.family_update_order(text, jsonb) to anon, authenticated;
grant execute on function public.public_memorial(text) to anon, authenticated;
grant execute on function public.invitation_preview(text) to anon, authenticated;
grant execute on function public.distance_km(double precision, double precision, double precision, double precision) to anon, authenticated;

-- Panel zakładu i administracja (zalogowani; uprawnienia szczegółowe sprawdzają same funkcje i RLS).
grant execute on function public.my_homes() to authenticated;
grant execute on function public.my_admin_homes() to authenticated;
grant execute on function public.my_owner_homes() to authenticated;
grant execute on function public.quote_for(uuid, burial_type, ceremony_type) to authenticated;
grant execute on function public.get_inbox() to authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.decline_offer(uuid) to authenticated;
grant execute on function public.queue_family_sms(uuid) to authenticated;
grant execute on function public.create_invitation(text, member_role, text) to authenticated;
grant execute on function public.team_members() to authenticated;
grant execute on function public.team_invitations() to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.assert_platform_admin() to authenticated;
grant execute on function public.admin_me() to authenticated;
grant execute on function public.admin_homes() to authenticated;
grant execute on function public.admin_create_home(jsonb) to authenticated;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_home_people(uuid) to authenticated;
grant execute on function public.admin_invite(uuid, text, member_role, text) to authenticated;
grant execute on function public.admin_escalations() to authenticated;
grant execute on function public.admin_mark_handled(uuid, text) to authenticated;
grant execute on function public.admin_billing(date) to authenticated;
grant execute on function public.admin_waiting_count() to authenticated;

-- Tabele utworzone po migracji 200 --------------------------------------------------------------
revoke all on public.push_subscriptions, public.notifications, public.invitations, public.platform_admins,
  public.admin_audit, public.inquiry_drafts, public.rate_limits from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant select on public.notifications to authenticated;
revoke all on all sequences in schema public from anon, authenticated;
-- Widoki kalendarza i rozliczeń: tylko odczyt dla zalogowanych (RLS tabel pod spodem dalej obowiązuje).
revoke all on public.calendar_events, public.billing_lines from anon, authenticated;
grant select on public.calendar_events, public.billing_lines to authenticated;

-- Konta logowania: aplikacja nie czyta auth.users wprost, tylko przez te funkcje (rola service_role).
create or replace function public.auth_user_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;
create or replace function public.auth_user_email(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select email from auth.users where id = p_user
$$;
-- Tylko lokalnie i w wersji testowej bez Supabase Auth (DEMO_MODE): konto w nakładce auth.users.
create or replace function public.demo_create_auth_user(p_email text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare v uuid;
begin
  insert into auth.users (id, email) values (gen_random_uuid(), lower(trim(p_email)))
  on conflict (email) do update set email = excluded.email
  returning id into v;
  return v;
end $$;
-- Lista kont testowych (@….test) na stronie logowania w trybie demo.
create or replace function public.demo_accounts()
returns table (user_id uuid, email text, display_name text, role text, home_name text)
language sql stable security definer set search_path = public as $$
  select a.user_id, a.email, a.display_name, a.role, a.name from (
    select m.user_id, u.email, m.display_name, m.role::text as role, h.name, 0 as ord
    from memberships m join auth.users u on u.id = m.user_id join funeral_homes h on h.id = m.home_id
    union all
    select p.user_id, u.email, p.display_name, 'admin', 'Ostoja – administracja', 1
    from platform_admins p join auth.users u on u.id = p.user_id
  ) a
  where a.email like '%.test'
  order by a.ord, a.name, a.role
$$;
-- Dokąd wpuścić konto po zalogowaniu.
create or replace function public.login_destination(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from memberships where user_id = p_user) then 'panel'
    when exists (select 1 from platform_admins where user_id = p_user) then 'admin'
  end
$$;
revoke all on function public.auth_user_by_email(text), public.auth_user_email(uuid), public.demo_create_auth_user(text),
  public.demo_accounts(), public.login_destination(uuid) from public, anon, authenticated;
grant execute on function public.auth_user_by_email(text), public.auth_user_email(uuid), public.demo_create_auth_user(text),
  public.demo_accounts(), public.login_destination(uuid) to service_role;

-- Rola logowania aplikacji (Vercel → baza). Bez własnych uprawnień: wszystko robi przez SET ROLE
-- anon / authenticated / service_role, tak jak API Supabase. Hasło nadaje się poza migracją.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'ostoja_app') then
    create role ostoja_app login noinherit;
  end if;
  execute 'grant anon, authenticated, service_role to ostoja_app';
exception when insufficient_privilege then
  raise notice 'Nie udało się utworzyć roli ostoja_app – aplikacja może łączyć się jako postgres (adres z Supabase → Connect).';
end $$;
