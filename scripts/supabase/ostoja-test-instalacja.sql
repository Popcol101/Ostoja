-- Ostoja – wersja testowa: brakujące migracje i dane testowe.
-- Wklej całość w Supabase → SQL Editor → New query i kliknij Run. Na pustym projekcie ostoja-test nic nie zostanie usunięte.
begin;

-- ===== 20261016000300_team =====
-- Zespół zakładu: zaproszenia pracowników przez właściciela, lista członków, usuwanie.
-- Zaproszenie to link z jednorazowym tokenem (w bazie tylko skrót SHA-256), ważny 7 dni.
-- Członkostwo powstaje wyłącznie dla konta, którego e-mail zgadza się z zaproszeniem.

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  home_id         uuid not null references funeral_homes on delete cascade,
  email           text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role            member_role not null,
  display_name    text not null check (length(display_name) between 2 and 120),
  token_hash      text not null unique,
  invited_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  accepted_user   uuid references auth.users on delete set null,
  revoked_at      timestamptz
);
create index invitations_home_idx on invitations (home_id);
-- Jedno otwarte zaproszenie na adres w zakładzie.
create unique index invitations_open_uniq on invitations (home_id, email)
  where accepted_at is null and revoked_at is null;

alter table invitations enable row level security;
-- Brak polityk i uprawnień: dostęp tylko przez funkcje poniżej.

create or replace function public.my_owner_homes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select home_id from memberships where user_id = auth.uid() and role = 'wlasciciel'
$$;
revoke all on function public.my_owner_homes() from public;
grant execute on function public.my_owner_homes() to authenticated;

-- Właściciel zaprasza. Zwraca token (jedyny raz, kiedy istnieje w jawnej postaci).
create or replace function public.create_invitation(p_email text, p_role member_role, p_name text)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_home uuid;
  v_email text := lower(trim(p_email));
  v_token text;
begin
  select home_id into v_home from memberships where user_id = auth.uid() and role = 'wlasciciel' limit 1;
  if v_home is null then
    raise exception 'Zapraszać może tylko właściciel zakładu' using errcode = '42501';
  end if;
  if exists (select 1 from memberships m join auth.users u on u.id = m.user_id
             where m.home_id = v_home and lower(u.email) = v_email) then
    raise exception 'Ta osoba ma już dostęp do panelu' using errcode = 'P0001';
  end if;
  -- Nowe zaproszenie zastępuje poprzednie otwarte na ten sam adres.
  update invitations set revoked_at = now()
  where home_id = v_home and email = v_email and accepted_at is null and revoked_at is null;

  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into invitations (home_id, email, role, display_name, token_hash, invited_by)
  values (v_home, v_email, p_role, trim(p_name), encode(digest(v_token, 'sha256'), 'hex'), auth.uid());
  return v_token;
end $$;
revoke all on function public.create_invitation(text, member_role, text) from public;
grant execute on function public.create_invitation(text, member_role, text) to authenticated;

-- Podgląd zaproszenia dla osoby z linkiem (bez logowania). Adres e-mail częściowo ukryty.
create or replace function public.invitation_preview(p_token text)
returns table (home_name text, role member_role, display_name text, email_hint text, status text)
language sql stable security definer set search_path = public, extensions as $$
  select h.name, i.role, i.display_name,
         left(i.email, 2) || '•••@' || split_part(i.email, '@', 2),
         case when i.revoked_at is not null then 'odwolane'
              when i.accepted_at is not null then 'przyjete'
              when i.expires_at <= now() then 'wygaslo'
              else 'aktywne' end
  from invitations i join funeral_homes h on h.id = i.home_id
  where i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
$$;
revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- E-mail z aktywnego zaproszenia: serwer potrzebuje go, żeby założyć konto i wysłać link logowania.
create or replace function public.invitation_email(p_token text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select email from invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and accepted_at is null and revoked_at is null and expires_at > now()
$$;
revoke all on function public.invitation_email(text) from public;
grant execute on function public.invitation_email(text) to anon;

-- Przyjęcie zaproszenia. p_user to konto o tym samym e-mailu co zaproszenie (sprawdzamy w auth.users).
create or replace function public.accept_invitation(p_token text, p_user uuid)
returns uuid language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_inv invitations%rowtype;
begin
  select * into v_inv from invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at <= now() then
    raise exception 'Zaproszenie wygasło albo zostało już użyte' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_user and lower(email) = v_inv.email) then
    raise exception 'Konto nie pasuje do zaproszenia' using errcode = '42501';
  end if;
  insert into memberships (user_id, home_id, role, display_name)
  values (p_user, v_inv.home_id, v_inv.role, v_inv.display_name)
  on conflict (user_id, home_id) do nothing;
  update invitations set accepted_at = now(), accepted_user = p_user where id = v_inv.id;
  return v_inv.home_id;
end $$;
revoke all on function public.accept_invitation(text, uuid) from public;
grant execute on function public.accept_invitation(text, uuid) to anon;

-- Lista zespołu i otwartych zaproszeń w zakładzie zalogowanej osoby.
create or replace function public.team_members()
returns table (user_id uuid, display_name text, email text, role member_role, is_me boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.display_name, u.email, m.role, m.user_id = auth.uid()
  from memberships m join auth.users u on u.id = m.user_id
  where m.home_id in (select my_homes())
  order by case m.role when 'wlasciciel' then 0 when 'biuro' then 1 else 2 end, m.display_name
$$;
revoke all on function public.team_members() from public;
grant execute on function public.team_members() to authenticated;

create or replace function public.team_invitations()
returns table (id uuid, email text, role member_role, display_name text, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.email, i.role, i.display_name, i.created_at, i.expires_at
  from invitations i
  where i.home_id in (select my_owner_homes())
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  order by i.created_at desc
$$;
revoke all on function public.team_invitations() from public;
grant execute on function public.team_invitations() to authenticated;

create or replace function public.revoke_invitation(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update invitations set revoked_at = now()
  where id = p_id and home_id in (select my_owner_homes()) and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'Nie znaleziono zaproszenia' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.revoke_invitation(uuid) from public;
grant execute on function public.revoke_invitation(uuid) to authenticated;

-- Właściciel odbiera dostęp. Nie można usunąć siebie (zakład zostałby bez właściciela).
create or replace function public.remove_member(p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_user = auth.uid() then
    raise exception 'Nie możesz usunąć własnego dostępu' using errcode = 'P0001';
  end if;
  delete from memberships where user_id = p_user and home_id in (select my_owner_homes());
  if not found then
    raise exception 'Nie znaleziono osoby w Twoim zakładzie' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.remove_member(uuid) from public;
grant execute on function public.remove_member(uuid) to authenticated;

-- ===== 20261016000400_admin =====
-- Panel administratora Ostoi (opiekunowie partnerów): ręczne dodawanie zakładów, weryfikacja,
-- zaproszenie właściciela, zapytania przekazane do opiekuna, rozliczenia wszystkich zakładów.
-- Administrator nie jest członkiem zakładu – nie widzi zleceń przez RLS; dostaje tylko to, co dają funkcje poniżej.
-- Każdy wgląd w dane kontaktowe rodzin i każda zmiana zapisuje się w admin_audit.

create table public.platform_admins (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);
alter table platform_admins enable row level security;

create table public.admin_audit (
  id         bigint generated always as identity primary key,
  admin_id   uuid references auth.users on delete set null,
  action     text not null,
  target     text,
  created_at timestamptz not null default now()
);
alter table admin_audit enable row level security;
-- Brak polityk i uprawnień do obu tabel: dostęp tylko przez funkcje.

alter table inquiries add column if not exists handled_at timestamptz;
alter table inquiries add column if not exists handled_note text check (length(handled_note) <= 500);

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.assert_platform_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'Tylko dla administratorów Ostoi' using errcode = '42501';
  end if;
end $$;
revoke all on function public.assert_platform_admin() from public;
grant execute on function public.assert_platform_admin() to authenticated;

create or replace function public.admin_log(p_action text, p_target text) returns void
language sql volatile security definer set search_path = public as $$
  insert into admin_audit (admin_id, action, target) values (auth.uid(), p_action, p_target)
$$;
revoke all on function public.admin_log(text, text) from public;

-- Lista zakładów z tym, co opiekun musi wiedzieć na pierwszy rzut oka.
create or replace function public.admin_homes()
returns table (id uuid, name text, city_name text, address text, phone text, email text, nip text,
               verified_at timestamptz, accepting_today boolean, members int, owners int,
               price_complete boolean, orders_month int, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select h.id, h.name, c.name, h.address, h.phone, h.email, h.nip, h.verified_at, h.accepting_today,
           (select count(*)::int from memberships m where m.home_id = h.id),
           (select count(*)::int from memberships m where m.home_id = h.id and m.role = 'wlasciciel'),
           quote_for(h.id, 'tradycyjny', 'religijna') is not null and quote_for(h.id, 'kremacja', 'bez') is not null,
           (select count(*)::int from orders o where o.home_id = h.id
              and o.created_at >= date_trunc('month', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'),
           h.created_at
    from funeral_homes h join cities c on c.slug = h.city_slug
    order by h.verified_at is not null, h.created_at desc;
end $$;
revoke all on function public.admin_homes() from public;
grant execute on function public.admin_homes() to authenticated;

-- Ręczne dodanie partnera. Zakład startuje jako niezweryfikowany (rodziny go nie widzą).
create or replace function public.admin_create_home(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_city cities%rowtype;
  v_id uuid;
  v_base text;
  v_slug text;
  v_n int := 1;
  v_nip text := regexp_replace(coalesce(p->>'nip', ''), '[^0-9]', '', 'g');
begin
  perform assert_platform_admin();
  select * into v_city from cities where slug = p->>'city_slug';
  if not found then
    raise exception 'Nieznane miasto' using errcode = '22023';
  end if;
  if length(v_nip) <> 10 then
    raise exception 'NIP ma 10 cyfr' using errcode = 'P0001';
  end if;
  if exists (select 1 from funeral_homes where nip = v_nip) then
    raise exception 'Zakład z tym NIP-em już jest w Ostoi' using errcode = 'P0001';
  end if;
  v_base := coalesce(nullif(p->>'slug', ''), 'zaklad');
  v_slug := v_base;
  while exists (select 1 from funeral_homes where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into funeral_homes (slug, name, nip, city_slug, address, phone, email, description, lat, lng,
                             service_radius_km, has_farewell_hall, accepting_today)
  values (v_slug, trim(p->>'name'), v_nip, v_city.slug, trim(p->>'address'), trim(p->>'phone'),
          lower(trim(p->>'email')), nullif(trim(p->>'description'), ''),
          coalesce(nullif(p->>'lat', '')::double precision, v_city.lat),
          coalesce(nullif(p->>'lng', '')::double precision, v_city.lng),
          coalesce(nullif(p->>'service_radius_km', '')::int, 25),
          coalesce((p->>'has_farewell_hall')::boolean, false), true)
  returning id into v_id;
  perform admin_log('dodanie zakładu', v_id::text);
  return v_id;
end $$;
revoke all on function public.admin_create_home(jsonb) from public;
grant execute on function public.admin_create_home(jsonb) to authenticated;

-- Weryfikacja (zakład widoczny dla rodzin) albo wstrzymanie (znika z listy ofert, nie dostaje zapytań).
create or replace function public.admin_set_verified(p_home uuid, p_verified boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  update funeral_homes set verified_at = case when p_verified then coalesce(verified_at, now()) else null end
  where id = p_home;
  if not found then
    raise exception 'Nie znaleziono zakładu' using errcode = 'P0001';
  end if;
  perform admin_log(case when p_verified then 'weryfikacja zakładu' else 'wstrzymanie zakładu' end, p_home::text);
end $$;
revoke all on function public.admin_set_verified(uuid, boolean) from public;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

-- Szczegóły zakładu dla opiekuna: osoby i otwarte zaproszenia.
create or replace function public.admin_home_people(p_home uuid)
returns table (kind text, name text, email text, role member_role, since timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select 'osoba', m.display_name, u.email, m.role, null::timestamptz
    from memberships m join auth.users u on u.id = m.user_id where m.home_id = p_home
    union all
    select 'zaproszenie', i.display_name, i.email, i.role, i.expires_at
    from invitations i where i.home_id = p_home and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    order by 1, 4, 2;
end $$;
revoke all on function public.admin_home_people(uuid) from public;
grant execute on function public.admin_home_people(uuid) to authenticated;

-- Zaproszenie dla właściciela (albo innej osoby) w dowolnym zakładzie. Zwraca token.
create or replace function public.admin_invite(p_home uuid, p_email text, p_role member_role, p_name text) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(p_email));
  v_token text;
begin
  perform assert_platform_admin();
  if not exists (select 1 from funeral_homes where id = p_home) then
    raise exception 'Nie znaleziono zakładu' using errcode = 'P0001';
  end if;
  if exists (select 1 from memberships m join auth.users u on u.id = m.user_id
             where m.home_id = p_home and lower(u.email) = v_email) then
    raise exception 'Ta osoba ma już dostęp do panelu' using errcode = 'P0001';
  end if;
  update invitations set revoked_at = now()
  where home_id = p_home and email = v_email and accepted_at is null and revoked_at is null;
  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into invitations (home_id, email, role, display_name, token_hash, invited_by)
  values (p_home, v_email, p_role, trim(p_name), encode(digest(v_token, 'sha256'), 'hex'), auth.uid());
  perform admin_log('zaproszenie (' || p_role || ')', p_home::text);
  return v_token;
end $$;
revoke all on function public.admin_invite(uuid, text, member_role, text) from public;
grant execute on function public.admin_invite(uuid, text, member_role, text) to authenticated;

-- Zapytania, których nie przyjął żaden zakład (po 3 rundach) – opiekun dzwoni do rodziny.
-- Zawierają telefon rodziny, więc każdy odczyt trafia do dziennika.
create or replace function public.admin_escalations()
returns table (id uuid, created_at timestamptz, city_name text, burial burial_type, ceremony ceremony_type,
               place_of_death place_of_death, budget text, contact_name text, contact_phone text,
               handled_at timestamptz, handled_note text)
language plpgsql volatile security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  perform admin_log('odczyt zapytań do opiekuna', null);
  return query
    select i.id, i.created_at, c.name, i.burial, i.ceremony, i.place_of_death, i.budget,
           i.contact_name, i.contact_phone, i.handled_at, i.handled_note
    from inquiries i join cities c on c.slug = i.city_slug
    where i.status = 'do_opiekuna' and (i.handled_at is null or i.handled_at > now() - interval '7 days')
    order by i.handled_at is not null, i.created_at;
end $$;
revoke all on function public.admin_escalations() from public;
grant execute on function public.admin_escalations() to authenticated;

create or replace function public.admin_mark_handled(p_inquiry uuid, p_note text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  update inquiries set handled_at = now(), handled_note = nullif(trim(p_note), '')
  where id = p_inquiry and status = 'do_opiekuna' and handled_at is null;
  if not found then
    raise exception 'Zapytanie jest już obsłużone' using errcode = 'P0001';
  end if;
  perform admin_log('obsłużenie zapytania', p_inquiry::text);
end $$;
revoke all on function public.admin_mark_handled(uuid, text) from public;
grant execute on function public.admin_mark_handled(uuid, text) to authenticated;

-- Rozliczenia wszystkich zakładów w miesiącu (do faktur).
create or replace function public.admin_billing(p_month date)
returns table (home_id uuid, home_name text, nip text, orders int, fee_pln numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select h.id, h.name, h.nip, count(b.*)::int, coalesce(sum(b.fee_net_pln), 0)::numeric
    from funeral_homes h
    join billing_lines b on b.home_id = h.id
    where b.billing_month = date_trunc('month', p_month::timestamp)::date
    group by h.id, h.name, h.nip
    order by h.name;
end $$;
revoke all on function public.admin_billing(date) from public;
grant execute on function public.admin_billing(date) to authenticated;

-- Imię administratora do nagłówka panelu (null, gdy zalogowana osoba nie jest administratorem).
create or replace function public.admin_me() returns text
language sql stable security definer set search_path = public as $$
  select display_name from platform_admins where user_id = auth.uid()
$$;
revoke all on function public.admin_me() from public;
grant execute on function public.admin_me() to authenticated;

-- Liczba zapytań czekających na opiekuna (bez danych kontaktowych – do znacznika w menu).
create or replace function public.admin_waiting_count() returns int
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return (select count(*)::int from inquiries where status = 'do_opiekuna' and handled_at is null);
end $$;
revoke all on function public.admin_waiting_count() from public;
grant execute on function public.admin_waiting_count() to authenticated;

-- ===== 20261016000500_phone_verification =====
-- Weryfikacja numeru rodziny kodem SMS przed wysłaniem zapytania.
-- Zapytanie (z telefonem rodziny) trafia do zakładów dopiero po wpisaniu kodu. Do tego czasu dane
-- czekają w inquiry_drafts najwyżej 10 minut (kod) i są kasowane po dobie.
-- Kod: 6 cyfr, w bazie tylko skrót SHA-256 z identyfikatorem szkicu, 5 prób, 3 wysyłki, ponowna wysyłka po 60 s.

create table public.inquiry_drafts (
  id           uuid primary key default gen_random_uuid(),
  payload      jsonb not null,
  phone        text not null check (phone ~ '^\+48 [0-9]{3} [0-9]{3} [0-9]{3}$'),
  code_hash    text not null,
  attempts     int not null default 0,
  sends        int not null default 1,
  last_sent_at timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '10 minutes',
  created_at   timestamptz not null default now()
);
create index inquiry_drafts_phone_idx on inquiry_drafts (phone, created_at);
alter table inquiry_drafts enable row level security;
-- Brak polityk i uprawnień: tylko funkcje poniżej.

-- Zapytanie bez weryfikacji nie może już powstać z zewnątrz (Supabase udostępnia funkcje roli anon przez API).
revoke execute on function public.create_inquiry(jsonb) from anon, authenticated;
grant execute on function public.create_inquiry(jsonb) to service_role;

create or replace function public.new_sms_code() returns text
language sql volatile set search_path = public, extensions as $$
  select lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0')
$$;
revoke all on function public.new_sms_code() from public;

create or replace function public.sms_code_hash(p_draft uuid, p_code text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(digest(p_draft::text || ':' || p_code, 'sha256'), 'hex')
$$;
revoke all on function public.sms_code_hash(uuid, text) from public;

-- Krok 1: dane z formularza + numer. Zwraca identyfikator szkicu i kod do wysłania SMS-em (tylko serwerowi).
create or replace function public.start_inquiry(p jsonb)
returns table (draft_id uuid, code text)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_id uuid := gen_random_uuid();
  v_code text := new_sms_code();
  v_phone text := p->>'contact_phone';
begin
  delete from inquiry_drafts where created_at < now() - interval '1 day';
  if not exists (select 1 from cities where slug = p->>'city_slug') then
    raise exception 'Nieznane miasto' using errcode = '22023';
  end if;
  -- Sprawdzenie typów teraz, nie dopiero po kodzie.
  perform (p->>'burial')::burial_type, (p->>'ceremony')::ceremony_type, (p->>'place_of_death')::place_of_death;
  if (select count(*) from inquiry_drafts where phone = v_phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Wysłaliśmy już kilka kodów na ten numer. Zadzwoń do opiekuna – pomożemy od razu.' using errcode = 'P0001';
  end if;
  insert into inquiry_drafts (id, payload, phone, code_hash)
  values (v_id, p - 'contact_phone', v_phone, sms_code_hash(v_id, v_code));
  return query select v_id, v_code;
end $$;
revoke all on function public.start_inquiry(jsonb) from public;
grant execute on function public.start_inquiry(jsonb) to anon;

-- Dane do ekranu z kodem: zamaskowany numer, kiedy można wysłać ponownie, parametry do powrotu.
create or replace function public.draft_info(p_draft uuid)
returns table (phone_hint text, expired boolean, blocked boolean, resend_in int, sends_left int,
               city_slug text, burial text, ceremony text, place_of_death text, budget text, preferred_home_id text)
language sql stable security definer set search_path = public as $$
  select left(d.phone, 8) || '••• ' || right(d.phone, 3),
         d.expires_at <= now(), d.attempts >= 5,
         greatest(0, 60 - extract(epoch from now() - d.last_sent_at))::int, 3 - d.sends,
         d.payload->>'city_slug', d.payload->>'burial', d.payload->>'ceremony', d.payload->>'place_of_death',
         d.payload->>'budget', d.payload->>'preferred_home_id'
  from inquiry_drafts d where d.id = p_draft
$$;
revoke all on function public.draft_info(uuid) from public;
grant execute on function public.draft_info(uuid) to anon;

-- Nowy kod (poprzedni przestaje działać). Zwraca kod i numer – serwer wysyła SMS.
create or replace function public.resend_inquiry_code(p_draft uuid)
returns table (code text, phone text)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v inquiry_drafts%rowtype;
  v_code text := new_sms_code();
begin
  select * into v from inquiry_drafts where id = p_draft for update;
  if not found or v.created_at < now() - interval '1 hour' then
    raise exception 'Ten formularz wygasł. Wypełnij go jeszcze raz.' using errcode = 'P0001';
  end if;
  if v.sends >= 3 then
    raise exception 'Wysłaliśmy już kilka kodów na ten numer. Zadzwoń do opiekuna – pomożemy od razu.' using errcode = 'P0001';
  end if;
  if v.last_sent_at > now() - interval '60 seconds' then
    raise exception 'Nowy kod możesz wysłać po minucie od poprzedniego.' using errcode = 'P0001';
  end if;
  update inquiry_drafts
  set code_hash = sms_code_hash(v.id, v_code), attempts = 0, sends = sends + 1, last_sent_at = now(),
      expires_at = now() + interval '10 minutes'
  where id = v.id;
  return query select v_code, v.phone;
end $$;
revoke all on function public.resend_inquiry_code(uuid) from public;
grant execute on function public.resend_inquiry_code(uuid) to anon;

-- Krok 2: kod. Zła próba nie przerywa transakcji (licznik prób musi się zapisać), dlatego zwracamy status.
create or replace function public.confirm_inquiry(p_draft uuid, p_code text)
returns table (status text, inquiry_id uuid, attempts_left int)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v inquiry_drafts%rowtype;
  v_inquiry uuid;
begin
  select * into v from inquiry_drafts where id = p_draft for update;
  if not found or v.expires_at <= now() then
    return query select 'wygasl'::text, null::uuid, 0;
    return;
  end if;
  if v.attempts >= 5 then
    return query select 'zablokowany'::text, null::uuid, 0;
    return;
  end if;
  if p_code !~ '^[0-9]{6}$' or sms_code_hash(v.id, p_code) <> v.code_hash then
    update inquiry_drafts set attempts = attempts + 1 where id = v.id;
    return query select 'zly'::text, null::uuid, 4 - v.attempts;
    return;
  end if;
  v_inquiry := create_inquiry(v.payload || jsonb_build_object('contact_phone', v.phone));
  update inquiries set phone_verified_at = now() where id = v_inquiry;
  delete from inquiry_drafts where id = v.id;
  return query select 'ok'::text, v_inquiry, 0;
end $$;
revoke all on function public.confirm_inquiry(uuid, text) from public;
grant execute on function public.confirm_inquiry(uuid, text) to anon;

-- ===== 20261016000600_hardening =====
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

-- ===== 20261016000700_supabase_parity =====
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

-- ===== dane testowe (supabase/seed.sql) =====
-- Ostoja: dane testowe. WSZYSTKIE osoby, zakłady i numery są fikcyjne.
-- Daty liczone względem dnia uruchomienia (strefa Europe/Warsaw).

insert into cities (slug, name, lat, lng) values
  ('lodz', 'Łódź', 51.7592, 19.4560),
  ('krakow', 'Kraków', 50.0647, 19.9450),
  ('warszawa', 'Warszawa', 52.2297, 21.0122),
  ('wroclaw', 'Wrocław', 51.1079, 17.0385),
  ('poznan', 'Poznań', 52.4064, 16.9252);

insert into price_catalog (item_key, label, for_burial, needs_ceremony, sort_order, optional) values
  ('transport',        'Odbiór i transport zmarłego',          'wszystkie',  false, 10, false),
  ('chlodnia',         'Przechowywanie w chłodni (do 5 dni)',   'wszystkie',  false, 20, false),
  ('przygotowanie',    'Przygotowanie i ubranie',               'wszystkie',  false, 30, false),
  ('trumna',           'Trumna',                                'tradycyjny', false, 40, false),
  ('trumna_kremacja',  'Trumna do kremacji i urna',             'kremacja',   false, 41, false),
  ('kremacja',         'Kremacja',                              'kremacja',   false, 50, false),
  ('ceremonia',        'Ceremonia, karawan, obsługa',           'wszystkie',  true,  60, false),
  ('formalnosci',      'Formalności i wniosek do ZUS',          'wszystkie',  false, 70, false),
  ('oprawa_muzyczna',  'Oprawa muzyczna',                       'wszystkie',  true,  80, true),
  ('wiazanka',         'Wiązanka od rodziny',                   'wszystkie',  false, 90, true),
  ('transmisja',       'Transmisja ceremonii online',           'wszystkie',  true,  95, true);

-- Użytkownicy (logowanie w trybie demo).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'anna@cisza.test',     '{"name":"Anna Cichońska"}'),
  ('00000000-0000-4000-8000-000000000002', 'ewa@cisza.test',      '{"name":"Ewa Rogalska"}'),
  ('00000000-0000-4000-8000-000000000003', 'adam@cisza.test',     '{"name":"Adam Sowiński"}'),
  ('00000000-0000-4000-8000-000000000004', 'piotr@podlipami.test','{"name":"Piotr Lipski"}'),
  ('00000000-0000-4000-8000-000000000005', 'kasia@kalina.test',   '{"name":"Katarzyna Kalinowska"}'),
  ('00000000-0000-4000-8000-000000000009', 'ola@ostoja.test',     '{"name":"Ola Maj"}')
on conflict (id) do nothing; -- reset wersji testowej zostawia konta w auth.users

insert into funeral_homes (id, slug, name, nip, city_slug, address, phone, email, description,
                           lat, lng, has_farewell_hall, rating, reviews_count, verified_at) values
  ('00000000-0000-4000-a000-000000000001', 'dom-pogrzebowy-cisza', 'Dom Pogrzebowy Cisza', '7270000001', 'lodz',
   'ul. Przykładowa 12, 90-001 Łódź', '+48 600 000 001', 'biuro@cisza.test',
   'Rodzinny zakład od 1998 roku. Własna chłodnia i dwa karawany.', 51.7700, 19.4700, true, 4.8, 37, now()),
  ('00000000-0000-4000-a000-000000000002', 'uslugi-pogrzebowe-pod-lipami', 'Usługi Pogrzebowe Pod Lipami', '7270000002', 'lodz',
   'ul. Lipowa 5, 90-002 Łódź', '+48 600 000 002', 'kontakt@podlipami.test',
   'Własna sala pożegnań na 80 osób.', 51.7900, 19.4300, true, 4.9, 52, now()),
  ('00000000-0000-4000-a000-000000000003', 'zaklad-pogrzebowy-kalina', 'Zakład Pogrzebowy Kalina', '7270000003', 'lodz',
   'ul. Kalinowa 3, 93-001 Łódź', '+48 600 000 003', 'kalina@kalina.test',
   null, 51.7000, 19.4100, false, 4.6, 19, now()),
  ('00000000-0000-4000-a000-000000000004', 'zaklad-pogrzebowy-spokoj', 'Zakład Pogrzebowy Spokój', '7270000004', 'lodz',
   'ul. Cicha 8, 92-001 Łódź', '+48 600 000 004', 'spokoj@spokoj.test',
   null, 51.7450, 19.5200, false, 4.4, 11, now()),
  ('00000000-0000-4000-a000-000000000005', 'uslugi-pogrzebowe-brzozowa', 'Usługi Pogrzebowe Brzozowa', '6760000005', 'krakow',
   'ul. Brzozowa 1, 30-001 Kraków', '+48 600 000 005', 'brzozowa@brzozowa.test',
   null, 50.0700, 19.9300, true, 4.7, 24, now()),
  ('00000000-0000-4000-a000-000000000006', 'nowy-zaklad-niezweryfikowany', 'Nowy Zakład (niezweryfikowany)', '7270000006', 'lodz',
   'ul. Nowa 1, 90-003 Łódź', '+48 600 000 006', 'nowy@nowy.test',
   null, 51.7600, 19.4600, false, null, 0, null);

insert into memberships (user_id, home_id, role, display_name) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-a000-000000000001', 'wlasciciel', 'Anna Cichońska'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-a000-000000000001', 'biuro', 'Ewa Rogalska'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-a000-000000000001', 'ekipa', 'Adam Sowiński'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-a000-000000000002', 'wlasciciel', 'Piotr Lipski'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-a000-000000000003', 'wlasciciel', 'Katarzyna Kalinowska');

-- Cenniki (kremacja z ceremonią: Cisza 5 790 zł, Pod Lipami 6 350 zł, Kalina 4 980 zł).
insert into price_items (home_id, item_key, price_pln)
select h.id, v.item_key, v.price from (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 'transport', 600), ('00000000-0000-4000-a000-000000000001'::uuid, 'chlodnia', 340),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'przygotowanie', 500), ('00000000-0000-4000-a000-000000000001'::uuid, 'trumna', 2400),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'trumna_kremacja', 1900), ('00000000-0000-4000-a000-000000000001'::uuid, 'kremacja', 1050),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'ceremonia', 1150), ('00000000-0000-4000-a000-000000000001'::uuid, 'formalnosci', 250),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'oprawa_muzyczna', 450), ('00000000-0000-4000-a000-000000000001'::uuid, 'wiazanka', 280),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'transmisja', 390),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'transport', 650), ('00000000-0000-4000-a000-000000000002'::uuid, 'chlodnia', 360),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'przygotowanie', 550), ('00000000-0000-4000-a000-000000000002'::uuid, 'trumna', 2700),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'trumna_kremacja', 2100), ('00000000-0000-4000-a000-000000000002'::uuid, 'kremacja', 1100),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'ceremonia', 1350), ('00000000-0000-4000-a000-000000000002'::uuid, 'formalnosci', 240),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'wiazanka', 300),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'transport', 520), ('00000000-0000-4000-a000-000000000003'::uuid, 'chlodnia', 300),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'przygotowanie', 450), ('00000000-0000-4000-a000-000000000003'::uuid, 'trumna', 2000),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'trumna_kremacja', 1600), ('00000000-0000-4000-a000-000000000003'::uuid, 'kremacja', 1000),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'ceremonia', 900), ('00000000-0000-4000-a000-000000000003'::uuid, 'formalnosci', 210),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'transport', 580), ('00000000-0000-4000-a000-000000000004'::uuid, 'chlodnia', 320),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'przygotowanie', 480), ('00000000-0000-4000-a000-000000000004'::uuid, 'trumna', 2300),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'trumna_kremacja', 1750), ('00000000-0000-4000-a000-000000000004'::uuid, 'kremacja', 1050),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'ceremonia', 1100), ('00000000-0000-4000-a000-000000000004'::uuid, 'formalnosci', 250),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'transport', 620), ('00000000-0000-4000-a000-000000000005'::uuid, 'chlodnia', 350),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'przygotowanie', 520), ('00000000-0000-4000-a000-000000000005'::uuid, 'trumna', 2500),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'trumna_kremacja', 1900), ('00000000-0000-4000-a000-000000000005'::uuid, 'kremacja', 1100),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'ceremonia', 1200), ('00000000-0000-4000-a000-000000000005'::uuid, 'formalnosci', 250)
) as v(home, item_key, price)
join funeral_homes h on h.id = v.home;

insert into resources (id, home_id, kind, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'karawan', 'Karawan 1'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001', 'karawan', 'Karawan 2'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000001', 'sala', 'Sala pożegnań'),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000002', 'karawan', 'Karawan'),
  ('00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-000000000002', 'sala', 'Sala pożegnań');

-- Zapytania, zlecenia, kalendarz i dyżury dla Domu Pogrzebowego Cisza.
do $$
declare
  d0 timestamptz := (date_trunc('day', now() at time zone 'Europe/Warsaw')) at time zone 'Europe/Warsaw';
  cisza uuid := '00000000-0000-4000-a000-000000000001';
  anna uuid := '00000000-0000-4000-8000-000000000001';
  ewa  uuid := '00000000-0000-4000-8000-000000000002';
  adam uuid := '00000000-0000-4000-8000-000000000003';
  i1 uuid := '00000000-0000-4000-c000-000000000001';
  i2 uuid := '00000000-0000-4000-c000-000000000002';
  i3 uuid := '00000000-0000-4000-c000-000000000003';
  i4 uuid := '00000000-0000-4000-c000-000000000004';
  i5 uuid := '00000000-0000-4000-c000-000000000005';
  o1 uuid := '00000000-0000-4000-d000-000000000001';
  o2 uuid := '00000000-0000-4000-d000-000000000002';
  o3 uuid := '00000000-0000-4000-d000-000000000003';
  o4 uuid := '00000000-0000-4000-d000-000000000004';
  o5 uuid := '00000000-0000-4000-d000-000000000005';
  e uuid;
begin
  -- Nowe zapytanie czekające w skrzynce (kremacja, ceremonia świecka).
  insert into inquiries (id, city_slug, burial, ceremony, place_of_death, budget, guests_estimate,
                         contact_name, contact_phone, created_at)
  values (i1, 'lodz', 'kremacja', 'swiecka', 'szpital', 'zasilek', 40, 'Marek Testowy', '+48 500 100 200',
          now() - interval '2 minutes');
  insert into offers (inquiry_id, home_id, quote_pln, distance_km, sent_at, expires_at) values
    (i1, cisza, 5790, 2.1, now() - interval '2 minutes', now() + interval '13 minutes'),
    (i1, '00000000-0000-4000-a000-000000000002', 6350, 4.1, now() - interval '2 minutes', now() + interval '13 minutes'),
    (i1, '00000000-0000-4000-a000-000000000003', 4980, 7.8, now() - interval '2 minutes', now() + interval '13 minutes');

  -- Zapytanie, którego nie przyjął żaden zakład (3 rundy) – czeka na telefon opiekuna Ostoi.
  insert into inquiries (city_slug, burial, ceremony, place_of_death, budget, contact_name, contact_phone,
                         status, dispatch_round, created_at)
  values ('krakow', 'tradycyjny', 'swiecka', 'dom', 'nie_wiem', 'Renata Testowa', '+48 500 100 299',
          'do_opiekuna', 3, now() - interval '50 minutes');

  -- Zapytania już przyjęte przez Ciszę.
  insert into inquiries (id, city_slug, burial, ceremony, place_of_death, contact_name, contact_phone, status, created_at) values
    (i2, 'lodz', 'kremacja',   'swiecka',   'szpital', 'Piotr Nowak',     '+48 500 100 201', 'przyjete', now() - interval '1 day 3 hours'),
    (i3, 'lodz', 'tradycyjny', 'religijna', 'dom',     'Joanna Kowalska', '+48 500 100 202', 'przyjete', now() - interval '20 hours'),
    (i4, 'lodz', 'kremacja',   'bez',       'dps',     'Tomasz Lis',      '+48 500 100 203', 'przyjete', now() - interval '12 days'),
    (i5, 'lodz', 'tradycyjny', 'religijna', 'szpital', 'Agata Mazur',     '+48 500 100 204', 'przyjete', now() - interval '3 hours');
  insert into offers (id, inquiry_id, home_id, status, quote_pln, distance_km, sent_at, expires_at, responded_at) values
    ('00000000-0000-4000-e000-000000000002', i2, cisza, 'przyjete', 5790, 2.1, now() - interval '1 day 3 hours', now() - interval '1 day 2 hours 45 minutes', now() - interval '1 day 2 hours 55 minutes'),
    ('00000000-0000-4000-e000-000000000003', i3, cisza, 'przyjete', 5240, 2.1, now() - interval '20 hours', now() - interval '19 hours 45 minutes', now() - interval '19 hours 52 minutes'),
    ('00000000-0000-4000-e000-000000000004', i4, cisza, 'przyjete', 4640, 2.1, now() - interval '12 days', now() - interval '12 days' + interval '15 minutes', now() - interval '12 days' + interval '6 minutes'),
    ('00000000-0000-4000-e000-000000000005', i5, cisza, 'przyjete', 5240, 2.1, now() - interval '3 hours', now() - interval '2 hours 45 minutes', now() - interval '2 hours 52 minutes');

  insert into orders (id, home_id, offer_id, stage, burial, ceremony, deceased_first_name, deceased_last_name,
                      born_on, died_at, principal_name, principal_phone, principal_email, zus_bank_account,
                      selected_items, total_pln, contract_signed_at, memorial_slug, memorial_published,
                      memorial_note, family_token, created_at) values
    (o1, cisza, '00000000-0000-4000-e000-000000000002', 'odbior', 'kremacja', 'swiecka', 'Halina', 'Nowak',
     '1948-03-12', now() - interval '1 day 5 hours', 'Piotr Nowak', '+48 500 100 201', 'piotr.nowak@example.test', null,
     array['transport','chlodnia','przygotowanie','trumna_kremacja','kremacja','ceremonia','formalnosci'], 5790,
     now() - interval '1 day', 'halina-nowak', true,
     'Mama, babcia i nauczycielka biologii. Najchętniej w ogrodzie, z książką i wnukami.',
     'demo-rodzina-nowak-0000000000000000000000000000', now() - interval '1 day 2 hours 55 minutes'),
    (o2, cisza, '00000000-0000-4000-e000-000000000003', 'przyjete', 'tradycyjny', 'religijna', 'Jan', 'Kowalski',
     '1941-07-02', now() - interval '22 hours', 'Joanna Kowalska', '+48 500 100 202', null, null,
     array['transport','chlodnia','przygotowanie','trumna','ceremonia','formalnosci'], 5240,
     null, null, false, null, 'demo-rodzina-kowalski-00000000000000000000000000', now() - interval '19 hours 52 minutes'),
    (o3, cisza, '00000000-0000-4000-e000-000000000004', 'rozliczenie', 'kremacja', 'bez', 'Teresa', 'Lis',
     '1950-11-20', now() - interval '13 days', 'Tomasz Lis', '+48 500 100 203', null, '12 3456 7890 1234 5678 9012 3456',
     array['transport','chlodnia','przygotowanie','trumna_kremacja','kremacja','formalnosci'], 4640,
     now() - interval '12 days', null, false, null, 'demo-rodzina-lis-000000000000000000000000000000', now() - interval '12 days'),
    (o4, cisza, null, 'ceremonia', 'tradycyjny', 'religijna', 'Maria', 'Zielińska',
     '1937-01-15', now() - interval '3 days', 'Krzysztof Zieliński', '+48 500 100 205', null, null,
     array['transport','chlodnia','przygotowanie','trumna','ceremonia','formalnosci'], 5240,
     now() - interval '2 days', null, false, null, 'demo-rodzina-zielinska-0000000000000000000000000', now() - interval '2 days 20 hours'),
    (o5, cisza, '00000000-0000-4000-e000-000000000005', 'przyjete', 'tradycyjny', 'religijna', 'Stanisław', 'Mazur',
     '1944-05-30', now() - interval '5 hours', 'Agata Mazur', '+48 500 100 204', null, null,
     array['transport','chlodnia','przygotowanie','trumna','ceremonia','formalnosci'], 5240,
     null, null, false, null, 'demo-rodzina-mazur-0000000000000000000000000000', now() - interval '2 hours 52 minutes');

  -- Zlecenie z umową zmienia etap triggerem tylko przy UPDATE; tu etapy ustawione ręcznie.

  insert into order_tasks (order_id, home_id, title, done, assignee, sort_order) values
    (o1, cisza, 'Zadzwonić do rodziny', true, ewa, 1),
    (o1, cisza, 'Wysłać rodzinie link do formularza', true, ewa, 2),
    (o1, cisza, 'Odbiór z prosektorium szpitala', false, adam, 3),
    (o1, cisza, 'Wybrać mistrza ceremonii świeckiej', false, ewa, 4),
    (o1, cisza, 'Uzupełnić numer konta do zasiłku', false, ewa, 5),
    (o2, cisza, 'Zadzwonić do rodziny', true, ewa, 1),
    (o2, cisza, 'Ustalić termin mszy z parafią', false, anna, 2),
    (o2, cisza, 'Podpisać umowę', false, anna, 3),
    (o5, cisza, 'Zadzwonić do rodziny', false, anna, 1),
    (o5, cisza, 'Wysłać rodzinie link do formularza', false, anna, 2),
    (o5, cisza, 'Ustalić termin pochówku', false, anna, 3);

  insert into events (id, home_id, order_id, kind, title, status, during, place, assignee) values
    ('00000000-0000-4000-f000-000000000001', cisza, o1, 'odbior', 'Odbiór: Halina Nowak', 'potwierdzony',
     tstzrange(d0 + interval '14 hours', d0 + interval '15 hours'), 'Prosektorium szpitala', adam),
    ('00000000-0000-4000-f000-000000000002', cisza, o1, 'kremacja', 'Kremacja: Halina Nowak', 'potwierdzony',
     tstzrange(d0 + interval '2 days 8 hours', d0 + interval '2 days 10 hours'), 'Krematorium', adam),
    ('00000000-0000-4000-f000-000000000003', cisza, o1, 'ceremonia', 'Ceremonia: Halina Nowak', 'potwierdzony',
     tstzrange(d0 + interval '3 days 11 hours', d0 + interval '3 days 12 hours'), 'Kaplica cmentarza komunalnego', anna),
    ('00000000-0000-4000-f000-000000000004', cisza, o2, 'ceremonia', 'Msza: Jan Kowalski', 'wstepny',
     tstzrange(d0 + interval '4 days 12 hours 30 minutes', d0 + interval '4 days 13 hours 30 minutes'), 'Kościół parafialny', anna),
    ('00000000-0000-4000-f000-000000000005', cisza, o2, 'pochowek', 'Pochówek: Jan Kowalski', 'wstepny',
     tstzrange(d0 + interval '4 days 13 hours 45 minutes', d0 + interval '4 days 14 hours 30 minutes'), 'Cmentarz parafialny', anna),
    ('00000000-0000-4000-f000-000000000006', cisza, o4, 'ceremonia', 'Ceremonia: Maria Zielińska', 'potwierdzony',
     tstzrange(d0 + interval '1 day 10 hours', d0 + interval '1 day 11 hours'), 'Sala pożegnań', anna),
    ('00000000-0000-4000-f000-000000000007', cisza, o4, 'pochowek', 'Pochówek: Maria Zielińska', 'potwierdzony',
     tstzrange(d0 + interval '1 day 11 hours 30 minutes', d0 + interval '1 day 12 hours 15 minutes'), 'Cmentarz komunalny', adam),
    -- Zbyt wczesny termin: pochówek niecałe 24 godziny po zgonie (kalendarz ostrzega).
    ('00000000-0000-4000-f000-000000000008', cisza, o5, 'pochowek', 'Pochówek: Stanisław Mazur', 'wstepny',
     tstzrange(now() + interval '15 hours', now() + interval '16 hours'), 'Cmentarz komunalny', anna),
    ('00000000-0000-4000-f000-000000000009', cisza, null, 'spotkanie', 'Dostawa trumien', 'potwierdzony',
     tstzrange(d0 + interval '1 day 8 hours', d0 + interval '1 day 9 hours'), 'Magazyn', adam);

  insert into bookings (event_id, resource_id, home_id, during) values
    ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-b000-000000000001', cisza, tstzrange(d0, d0)),
    ('00000000-0000-4000-f000-000000000003', '00000000-0000-4000-b000-000000000002', cisza, tstzrange(d0, d0)),
    ('00000000-0000-4000-f000-000000000006', '00000000-0000-4000-b000-000000000003', cisza, tstzrange(d0, d0)),
    ('00000000-0000-4000-f000-000000000007', '00000000-0000-4000-b000-000000000001', cisza, tstzrange(d0, d0)),
    ('00000000-0000-4000-f000-000000000004', '00000000-0000-4000-b000-000000000001', cisza, tstzrange(d0, d0));

  insert into duty_shifts (home_id, user_id, during) values
    (cisza, anna, tstzrange(d0 + interval '20 hours', d0 + interval '1 day 8 hours')),
    (cisza, ewa,  tstzrange(d0 + interval '1 day 20 hours', d0 + interval '2 days 8 hours')),
    (cisza, adam, tstzrange(d0 + interval '2 days 20 hours', d0 + interval '3 days 8 hours'));
end $$;

-- Administratorka Ostoi (opiekunka partnerów) – panel /admin.
insert into platform_admins (user_id, display_name) values
  ('00000000-0000-4000-8000-000000000009', 'Ola Maj')
on conflict (user_id) do nothing;

commit;
