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
