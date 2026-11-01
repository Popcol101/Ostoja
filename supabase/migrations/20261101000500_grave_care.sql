-- Opieka nad grobem: baza cmentarzy i parafii, konta usługodawców (znicze, kwiaty, sprzątanie), zamówienia
-- jednorazowe i stałe od klientów bez konta, potwierdzenie wykonania zdjęciem grobu.
-- Zasady:
-- * Usługę można zamówić tylko, gdy da się ustalić, jak dojść do grobu: cmentarz z wyszukiwarką grobów (Grobonet albo
--   miejska) i kwatera/rząd/numer – albo współrzędne GPS grobu. Inaczej baza odrzuca zamówienie.
-- * Tylko na cmentarzach, które obsługuje zweryfikowany usługodawca.
-- * Ceny ustala Ostoja (katalog poniżej): usługa 40 zł + wybrane znicze/kwiaty, sprzątanie 60 zł.
-- * Płatności: na razie tryb testowy (bez operatora); kolumny payment_* są gotowe na Przelewy24/Stripe.
-- * Klient widzi zamówienie przez link z tokenem (jak rodzina w zleceniu pogrzebu); usługodawca – tylko przez funkcje,
--   bez telefonu i e-maila klienta. Zdjęcie trzymamy w bazie (pilotaż; później Supabase Storage).

-- Cmentarze i parafie -----------------------------------------------------------------

create type public.cemetery_kind as enum ('komunalny', 'parafialny', 'wojskowy', 'wyznaniowy', 'inny');
create type public.grave_locator as enum ('grobonet', 'miejska', 'brak');

create table public.parishes (
  id        uuid primary key default gen_random_uuid(),
  name      text not null check (length(name) between 3 and 160),
  city      text not null check (length(city) between 2 and 80),
  address   text check (length(address) <= 160),
  diocese   text check (length(diocese) <= 80),
  phrase    text check (length(phrase) <= 200), -- jak w klepsydrze, np. „w kościele pw. św. Anny w Łodzi”
  source    text not null default 'reczny' check (source in ('reczny', 'test', 'osm'))
);
create index parishes_city_idx on public.parishes (city, name);

create table public.cemeteries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 3 and 160),
  city        text not null check (length(city) between 2 and 80),
  address     text check (length(address) <= 160),
  kind        public.cemetery_kind not null default 'komunalny',
  parish_id   uuid references public.parishes (id) on delete set null,
  locator     public.grave_locator not null default 'brak',
  locator_url text check (locator_url ~ '^https?://'),
  lat         double precision check (lat between 49 and 55),
  lng         double precision check (lng between 14 and 25),
  phrase      text check (length(phrase) <= 200), -- jak w klepsydrze, np. „na Cmentarzu Komunalnym Doły w Łodzi”
  source      text not null default 'reczny' check (source in ('reczny', 'test', 'osm', 'grobonet'))
);
create index cemeteries_city_idx on public.cemeteries (city, name);

alter table public.parishes enable row level security;
alter table public.cemeteries enable row level security;
revoke all on public.parishes, public.cemeteries from anon, authenticated;
grant select on public.parishes, public.cemeteries to anon, authenticated;
create policy parishes_read on public.parishes for select to anon, authenticated using (true);
create policy cemeteries_read on public.cemeteries for select to anon, authenticated using (true);

-- Usługodawcy -------------------------------------------------------------------------

create table public.providers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 3 and 120),
  nip         text not null unique check (nip ~ '^[0-9]{10}$'),
  phone       text not null check (phone ~ '^\+?[0-9 ]{9,16}$'),
  email       text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  city        text not null check (length(city) between 2 and 80),
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create table public.provider_members (
  user_id      uuid not null references auth.users on delete cascade,
  provider_id  uuid not null references public.providers (id) on delete cascade,
  role         text not null check (role in ('wlasciciel', 'pracownik')),
  display_name text not null check (length(display_name) between 2 and 120),
  primary key (user_id, provider_id)
);

create table public.provider_cemeteries (
  provider_id uuid not null references public.providers (id) on delete cascade,
  cemetery_id uuid not null references public.cemeteries (id) on delete cascade,
  primary key (provider_id, cemetery_id)
);

alter table public.providers enable row level security;
alter table public.provider_members enable row level security;
alter table public.provider_cemeteries enable row level security;
revoke all on public.providers, public.provider_members, public.provider_cemeteries from anon, authenticated;
grant select on public.providers, public.provider_members, public.provider_cemeteries to authenticated;

create or replace function public.my_providers() returns setof uuid
language sql stable security definer set search_path = public as $$
  select provider_id from provider_members where user_id = auth.uid()
$$;
revoke all on function public.my_providers() from public;
grant execute on function public.my_providers() to authenticated;

create policy providers_member_read on public.providers for select to authenticated using (id in (select my_providers()));
create policy provider_members_read on public.provider_members for select to authenticated using (provider_id in (select my_providers()));
create policy provider_cemeteries_read on public.provider_cemeteries for select to authenticated using (provider_id in (select my_providers()));

-- Zaproszenia: do zakładu albo do usługodawcy (dokładnie jedno).
alter table public.invitations alter column home_id drop not null;
alter table public.invitations add column provider_id uuid references public.providers (id) on delete cascade;
alter table public.invitations add constraint invitations_target_chk check ((home_id is null) <> (provider_id is null));
create unique index invitations_provider_open_uniq on public.invitations (provider_id, email)
  where provider_id is not null and accepted_at is null and revoked_at is null;

create or replace function public.invitation_preview(p_token text)
returns table (home_name text, role member_role, display_name text, email_hint text, status text)
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(h.name, p.name), i.role, i.display_name,
         left(i.email, 2) || '•••@' || split_part(i.email, '@', 2),
         case when i.revoked_at is not null then 'odwolane'
              when i.accepted_at is not null then 'przyjete'
              when i.expires_at <= now() then 'wygaslo'
              else 'aktywne' end
  from invitations i
  left join funeral_homes h on h.id = i.home_id
  left join providers p on p.id = i.provider_id
  where i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
$$;

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
  if v_inv.provider_id is not null then
    insert into provider_members (user_id, provider_id, role, display_name)
    values (p_user, v_inv.provider_id, case when v_inv.role = 'wlasciciel' then 'wlasciciel' else 'pracownik' end, v_inv.display_name)
    on conflict (user_id, provider_id) do nothing;
  else
    insert into memberships (user_id, home_id, role, display_name)
    values (p_user, v_inv.home_id, v_inv.role, v_inv.display_name)
    on conflict (user_id, home_id) do nothing;
  end if;
  update invitations set accepted_at = now(), accepted_user = p_user where id = v_inv.id;
  return coalesce(v_inv.home_id, v_inv.provider_id);
end $$;

create or replace function public.login_destination(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from memberships where user_id = p_user) then 'panel'
    when exists (select 1 from provider_members where user_id = p_user) then 'uslugi'
    when exists (select 1 from platform_admins where user_id = p_user) then 'admin'
  end
$$;

create or replace function public.demo_accounts()
returns table (user_id uuid, email text, display_name text, role text, home_name text)
language sql stable security definer set search_path = public as $$
  select a.user_id, a.email, a.display_name, a.role, a.name from (
    select m.user_id, u.email, m.display_name, m.role::text as role, h.name, 0 as ord
    from memberships m join auth.users u on u.id = m.user_id join funeral_homes h on h.id = m.home_id
    union all
    select pm.user_id, u.email, pm.display_name, 'uslugodawca', p.name, 1
    from provider_members pm join auth.users u on u.id = pm.user_id join providers p on p.id = pm.provider_id
    union all
    select p.user_id, u.email, p.display_name, 'admin', 'Ostoja – administracja', 2
    from platform_admins p join auth.users u on u.id = p.user_id
  ) a
  where a.email like '%.test'
  order by a.ord, a.name, a.role
$$;

-- Katalog usług i cen (ustala Ostoja) ---------------------------------------------------

create table public.grave_services (
  key            text primary key,
  label          text not null,
  description    text not null,
  base_price_pln numeric(10,2) not null check (base_price_pln >= 0),
  product_kind   text check (product_kind in ('znicz', 'kwiaty')),
  sort_order     int not null
);
create table public.grave_products (
  key        text primary key,
  kind       text not null check (kind in ('znicz', 'kwiaty')),
  label      text not null,
  price_pln  numeric(10,2) not null check (price_pln >= 0),
  is_default boolean not null default false,
  active     boolean not null default true,
  sort_order int not null
);
alter table public.grave_services enable row level security;
alter table public.grave_products enable row level security;
revoke all on public.grave_services, public.grave_products from anon, authenticated;
grant select on public.grave_services, public.grave_products to anon, authenticated;
create policy grave_services_read on public.grave_services for select to anon, authenticated using (true);
create policy grave_products_read on public.grave_products for select to anon, authenticated using (true);

insert into public.grave_services (key, label, description, base_price_pln, product_kind, sort_order) values
  ('znicz', 'Zapalenie znicza', 'Przyniesiemy i zapalimy znicz. Cena usługi plus wybrane znicze.', 40, 'znicz', 10),
  ('kwiaty', 'Postawienie kwiatów', 'Kupimy i postawimy kwiaty. Cena usługi plus wybrane kwiaty.', 40, 'kwiaty', 20),
  ('sprzatanie', 'Sprzątanie grobu', 'Usuniemy wypalone znicze i zwiędłe kwiaty, umyjemy płytę, zamieciemy wokół.', 60, null, 30);

insert into public.grave_products (key, kind, label, price_pln, is_default, sort_order) values
  ('znicz_1d', 'znicz', 'Znicz szklany, pali się ok. 1 dnia', 10, true, 10),
  ('znicz_3d', 'znicz', 'Znicz szklany, pali się ok. 3 dni', 15, false, 20),
  ('znicz_7d', 'znicz', 'Znicz duży, pali się ok. 7 dni', 25, false, 30),
  ('znicz_led', 'znicz', 'Znicz LED na baterie, świeci ok. 30 dni', 20, false, 40),
  ('chryzantema', 'kwiaty', 'Chryzantema w doniczce', 35, true, 10),
  ('wiazanka', 'kwiaty', 'Wiązanka z kwiatów sezonowych', 50, false, 20),
  ('roze', 'kwiaty', 'Bukiet 5 białych róż', 60, false, 30),
  ('stroik', 'kwiaty', 'Stroik z gałązek i szyszek (zima)', 45, false, 40);

-- Wycena: [{"service":"znicz","products":[{"key":"znicz_1d","qty":2}]}, {"service":"sprzatanie"}]
create or replace function public.grave_quote(p_items jsonb) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  v_item jsonb;
  v_prod jsonb;
  v_service grave_services%rowtype;
  v_product grave_products%rowtype;
  v_qty int;
  v_total numeric := 0;
  v_seen text[] := '{}';
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Wybierz co najmniej jedną usługę.' using errcode = 'P0001';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_service from grave_services where key = v_item->>'service';
    if not found or v_service.key = any(v_seen) then
      raise exception 'Nieprawidłowa usługa.' using errcode = 'P0001';
    end if;
    v_seen := v_seen || v_service.key;
    v_total := v_total + v_service.base_price_pln;
    if v_service.product_kind is not null then
      if jsonb_typeof(v_item->'products') <> 'array' or jsonb_array_length(v_item->'products') = 0 then
        raise exception 'Wybierz znicz albo kwiaty do usługi.' using errcode = 'P0001';
      end if;
      for v_prod in select * from jsonb_array_elements(v_item->'products') loop
        select * into v_product from grave_products where key = v_prod->>'key' and kind = v_service.product_kind and active;
        v_qty := coalesce((v_prod->>'qty')::int, 0);
        if not found or v_qty not between 1 and 20 then
          raise exception 'Nieprawidłowy produkt albo liczba sztuk.' using errcode = 'P0001';
        end if;
        v_total := v_total + v_product.price_pln * v_qty;
      end loop;
    end if;
  end loop;
  return v_total;
end $$;
revoke all on function public.grave_quote(jsonb) from public;
grant execute on function public.grave_quote(jsonb) to anon, authenticated, service_role;

-- Zamówienia i wizyty ------------------------------------------------------------------

create type public.grave_frequency as enum ('jednorazowo', 'co_tydzien', 'co_miesiac', 'swieta');
create type public.grave_order_status as enum ('do_zaplaty', 'oplacone', 'anulowane');
create type public.grave_visit_status as enum ('zaplanowana', 'wykonana', 'nie_wykonano');

create table public.grave_orders (
  id               uuid primary key default gen_random_uuid(),
  token            text not null unique default encode(gen_random_bytes(24), 'hex'),
  cemetery_id      uuid not null references public.cemeteries (id),
  provider_id      uuid references public.providers (id),
  deceased_name    text not null check (length(deceased_name) between 2 and 120),
  grave_section    text check (length(grave_section) <= 20),
  grave_row        text check (length(grave_row) <= 20),
  grave_number     text check (length(grave_number) <= 20),
  grave_lat        double precision check (grave_lat between 49 and 55),
  grave_lng        double precision check (grave_lng between 14 and 25),
  grave_notes      text check (length(grave_notes) <= 300),
  customer_name    text not null check (length(customer_name) between 2 and 120),
  customer_email   text not null check (customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  customer_phone   text check (customer_phone ~ '^\+?[0-9 ]{9,16}$'),
  items            jsonb not null,
  total_pln        numeric(10,2) not null,
  frequency        public.grave_frequency not null default 'jednorazowo',
  first_on         date not null,
  status           public.grave_order_status not null default 'do_zaplaty',
  payment_provider text check (payment_provider in ('test', 'przelewy24', 'stripe')),
  payment_ref      text check (length(payment_ref) <= 80),
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index grave_orders_provider_idx on public.grave_orders (provider_id);

create table public.grave_visits (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.grave_orders (id) on delete cascade,
  provider_id uuid not null references public.providers (id),
  due_on      date not null,
  status      public.grave_visit_status not null default 'zaplanowana',
  done_at     timestamptz,
  note        text check (length(note) <= 300),
  photo       bytea,
  photo_mime  text check (photo_mime in ('image/jpeg', 'image/png', 'image/webp')),
  unique (order_id, due_on)
);
create index grave_visits_provider_idx on public.grave_visits (provider_id, due_on);

alter table public.grave_orders enable row level security;
alter table public.grave_visits enable row level security;
revoke all on public.grave_orders, public.grave_visits from anon, authenticated;
-- Brak polityk i uprawnień: dostęp tylko przez funkcje poniżej.

-- Następny termin dla zleceń stałych. „Święta” = przed Wszystkimi Świętymi (31.10) i przed Wigilią (23.12).
create or replace function public.next_grave_date(p_freq grave_frequency, p_after date) returns date
language sql immutable set search_path = public as $$
  select case p_freq
    when 'co_tydzien' then p_after + 7
    when 'co_miesiac' then (p_after + interval '1 month')::date
    when 'swieta' then (
      select min(d) from (values
        (make_date(extract(year from p_after)::int, 10, 31)),
        (make_date(extract(year from p_after)::int, 12, 23)),
        (make_date(extract(year from p_after)::int + 1, 10, 31))) v(d)
      where d > p_after)
    else null
  end
$$;
revoke all on function public.next_grave_date(grave_frequency, date) from public;

-- Czy da się dojść do grobu: wyszukiwarka grobów + kwatera/rząd/numer, albo GPS.
create or replace function public.grave_findable(p_cemetery uuid, p_section text, p_row text, p_number text, p_lat double precision, p_lng double precision)
returns boolean language sql stable security definer set search_path = public as $$
  select (p_lat is not null and p_lng is not null)
      or exists (select 1 from cemeteries c where c.id = p_cemetery and c.locator <> 'brak'
                 and nullif(trim(coalesce(p_section, '')), '') is not null
                 and nullif(trim(coalesce(p_number, '')), '') is not null)
$$;
revoke all on function public.grave_findable(uuid, text, text, text, double precision, double precision) from public;
grant execute on function public.grave_findable(uuid, text, text, text, double precision, double precision) to service_role;

-- Cmentarze z usługodawcą (lista w formularzu zamówienia).
create or replace function public.grave_care_cemeteries()
returns table (id uuid, name text, city text, locator grave_locator, locator_url text, has_provider boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.city, c.locator, c.locator_url,
         exists (select 1 from provider_cemeteries pc join providers p on p.id = pc.provider_id
                 where pc.cemetery_id = c.id and p.verified_at is not null)
  from cemeteries c
  order by c.city, c.name
$$;
revoke all on function public.grave_care_cemeteries() from public;
grant execute on function public.grave_care_cemeteries() to anon, authenticated, service_role;

-- Nowe zamówienie (serwer aplikacji po walidacji i limicie prób). Zwraca token linku dla klienta.
create or replace function public.create_grave_order(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_cemetery cemeteries%rowtype;
  v_lat double precision := nullif(p->>'grave_lat', '')::double precision;
  v_lng double precision := nullif(p->>'grave_lng', '')::double precision;
  v_first date := coalesce(nullif(p->>'first_on', '')::date, current_date + 1);
  v_token text;
begin
  select * into v_cemetery from cemeteries where id = (p->>'cemetery_id')::uuid;
  if not found then
    raise exception 'Wybierz cmentarz z listy.' using errcode = 'P0001';
  end if;
  if not grave_findable(v_cemetery.id, p->>'grave_section', p->>'grave_row', p->>'grave_number', v_lat, v_lng) then
    raise exception 'Nie da się ustalić, jak dojść do grobu. Podaj kwaterę i numer z wyszukiwarki grobów albo – stojąc przy grobie – użyj położenia z telefonu.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from provider_cemeteries pc join providers pr on pr.id = pc.provider_id
                 where pc.cemetery_id = v_cemetery.id and pr.verified_at is not null) then
    raise exception 'Na tym cmentarzu nie mamy jeszcze usługodawcy.' using errcode = 'P0001';
  end if;
  if v_first < current_date + 1 or v_first > current_date + 120 then
    raise exception 'Wybierz termin od jutra do 4 miesięcy naprzód.' using errcode = 'P0001';
  end if;
  insert into grave_orders (cemetery_id, deceased_name, grave_section, grave_row, grave_number, grave_lat, grave_lng, grave_notes,
                            customer_name, customer_email, customer_phone, items, total_pln, frequency, first_on)
  values (v_cemetery.id, trim(p->>'deceased_name'), nullif(trim(coalesce(p->>'grave_section', '')), ''),
          nullif(trim(coalesce(p->>'grave_row', '')), ''), nullif(trim(coalesce(p->>'grave_number', '')), ''),
          v_lat, v_lng, nullif(trim(coalesce(p->>'grave_notes', '')), ''),
          trim(p->>'customer_name'), lower(trim(p->>'customer_email')), nullif(trim(coalesce(p->>'customer_phone', '')), ''),
          p->'items', grave_quote(p->'items'), coalesce(nullif(p->>'frequency', ''), 'jednorazowo')::grave_frequency, v_first)
  returning token into v_token;
  return v_token;
end $$;
revoke all on function public.create_grave_order(jsonb) from public;
grant execute on function public.create_grave_order(jsonb) to service_role;

-- Zamówienie dla klienta (link z tokenem): usługi, cena, termin, wizyty ze zdjęciem.
create or replace function public.grave_order_by_token(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', g.status, 'total_pln', g.total_pln, 'frequency', g.frequency, 'first_on', g.first_on,
    'deceased_name', g.deceased_name, 'customer_name', g.customer_name, 'customer_email', g.customer_email,
    'grave_section', g.grave_section, 'grave_row', g.grave_row, 'grave_number', g.grave_number,
    'has_gps', g.grave_lat is not null, 'items', g.items, 'paid_at', g.paid_at,
    'cemetery', jsonb_build_object('name', c.name, 'city', c.city),
    'provider', (select jsonb_build_object('name', pr.name, 'phone', pr.phone) from providers pr where pr.id = g.provider_id),
    'visits', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', v.id, 'due_on', v.due_on, 'status', v.status, 'done_at', v.done_at, 'note', v.note,
                  'has_photo', v.photo is not null) order by v.due_on desc), '[]')
               from grave_visits v where v.order_id = g.id)
  )
  from grave_orders g join cemeteries c on c.id = g.cemetery_id
  where g.token = p_token
$$;
revoke all on function public.grave_order_by_token(text) from public;
grant execute on function public.grave_order_by_token(text) to anon, authenticated, service_role;

-- Zdjęcie z wizyty dla klienta (link z tokenem).
create or replace function public.grave_visit_photo(p_token text, p_visit uuid)
returns table (photo bytea, photo_mime text)
language sql stable security definer set search_path = public as $$
  select v.photo, v.photo_mime from grave_visits v join grave_orders g on g.id = v.order_id
  where g.token = p_token and v.id = p_visit and v.photo is not null
$$;
revoke all on function public.grave_visit_photo(text, uuid) from public;
grant execute on function public.grave_visit_photo(text, uuid) to anon, authenticated, service_role;

-- Opłacenie (na razie tylko tryb testowy; włącza go aplikacja zmienną GRAVE_PAYMENTS=test).
-- Przydziela usługodawcę obsługującego cmentarz i planuje pierwszą wizytę.
create or replace function public.mark_grave_order_paid(p_token text, p_provider text, p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order grave_orders%rowtype;
  v_provider uuid;
begin
  select * into v_order from grave_orders where token = p_token for update;
  if not found then
    raise exception 'Nie znaleziono zamówienia.' using errcode = 'P0001';
  end if;
  if v_order.status = 'oplacone' then
    return grave_order_by_token(p_token);
  end if;
  if v_order.status <> 'do_zaplaty' then
    raise exception 'To zamówienie jest anulowane.' using errcode = 'P0001';
  end if;
  select pc.provider_id into v_provider
  from provider_cemeteries pc join providers pr on pr.id = pc.provider_id
  where pc.cemetery_id = v_order.cemetery_id and pr.verified_at is not null
  order by (select count(*) from grave_visits gv where gv.provider_id = pc.provider_id and gv.status = 'zaplanowana'), pr.created_at
  limit 1;
  if v_provider is null then
    raise exception 'Na tym cmentarzu nie mamy jeszcze usługodawcy.' using errcode = 'P0001';
  end if;
  update grave_orders set status = 'oplacone', paid_at = now(), payment_provider = p_provider, payment_ref = p_ref, provider_id = v_provider
  where id = v_order.id;
  insert into grave_visits (order_id, provider_id, due_on) values (v_order.id, v_provider, v_order.first_on);
  return grave_order_by_token(p_token);
end $$;
revoke all on function public.mark_grave_order_paid(text, text, text) from public;
grant execute on function public.mark_grave_order_paid(text, text, text) to service_role;

-- Panel usługodawcy -----------------------------------------------------------------------

create or replace function public.provider_visits(p_days int default 60)
returns table (visit_id uuid, due_on date, status grave_visit_status, done_at timestamptz, note text, has_photo boolean,
               frequency grave_frequency, items jsonb, deceased_name text,
               cemetery_name text, cemetery_city text, locator grave_locator, locator_url text,
               grave_section text, grave_row text, grave_number text, grave_lat double precision, grave_lng double precision,
               grave_notes text)
language sql stable security definer set search_path = public as $$
  select v.id, v.due_on, v.status, v.done_at, v.note, v.photo is not null, g.frequency, g.items, g.deceased_name,
         c.name, c.city, c.locator, c.locator_url, g.grave_section, g.grave_row, g.grave_number, g.grave_lat, g.grave_lng, g.grave_notes
  from grave_visits v
  join grave_orders g on g.id = v.order_id
  join cemeteries c on c.id = g.cemetery_id
  where v.provider_id in (select my_providers())
    and (v.status = 'zaplanowana' or v.due_on >= current_date - p_days)
  order by (v.status <> 'zaplanowana'), v.due_on
$$;
revoke all on function public.provider_visits(int) from public;
grant execute on function public.provider_visits(int) to authenticated;

-- Wykonanie wizyty: zdjęcie grobu jest obowiązkowe. Przy zleceniu stałym planuje następną wizytę.
create or replace function public.complete_grave_visit(p_visit uuid, p_photo bytea, p_mime text, p_note text) returns date
language plpgsql security definer set search_path = public as $$
declare
  v_visit grave_visits%rowtype;
  v_order grave_orders%rowtype;
  v_next date;
begin
  select * into v_visit from grave_visits where id = p_visit and provider_id in (select my_providers()) for update;
  if not found then
    raise exception 'Brak dostępu do tej wizyty' using errcode = '42501';
  end if;
  if v_visit.status <> 'zaplanowana' then
    raise exception 'Ta wizyta jest już zamknięta.' using errcode = 'P0001';
  end if;
  if p_photo is null or length(p_photo) < 1000 or length(p_photo) > 3000000 or p_mime not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Dodaj zdjęcie grobu (JPG, PNG albo WebP, do 3 MB).' using errcode = 'P0001';
  end if;
  update grave_visits set status = 'wykonana', done_at = now(), photo = p_photo, photo_mime = p_mime,
         note = nullif(trim(coalesce(p_note, '')), '')
  where id = v_visit.id;
  select * into v_order from grave_orders where id = v_visit.order_id;
  v_next := next_grave_date(v_order.frequency, greatest(v_visit.due_on, current_date));
  if v_next is not null and v_order.status = 'oplacone' then
    insert into grave_visits (order_id, provider_id, due_on) values (v_order.id, v_visit.provider_id, v_next)
    on conflict (order_id, due_on) do nothing;
  end if;
  return v_next;
end $$;
revoke all on function public.complete_grave_visit(uuid, bytea, text, text) from public;
grant execute on function public.complete_grave_visit(uuid, bytea, text, text) to authenticated;

create or replace function public.provider_visit_photo(p_visit uuid)
returns table (photo bytea, photo_mime text)
language sql stable security definer set search_path = public as $$
  select photo, photo_mime from grave_visits where id = p_visit and provider_id in (select my_providers()) and photo is not null
$$;
revoke all on function public.provider_visit_photo(uuid) from public;
grant execute on function public.provider_visit_photo(uuid) to authenticated;

-- Dane do e-maila z potwierdzeniem i zdjęciem (serwer).
create or replace function public.grave_order_contact(p_visit uuid) returns table (token text, customer_email text, customer_name text, deceased_name text)
language sql stable security definer set search_path = public as $$
  select g.token, g.customer_email, g.customer_name, g.deceased_name from grave_visits v join grave_orders g on g.id = v.order_id where v.id = p_visit
$$;
revoke all on function public.grave_order_contact(uuid) from public;
grant execute on function public.grave_order_contact(uuid) to service_role;

-- Administrator Ostoi: usługodawcy ---------------------------------------------------------

create or replace function public.admin_create_provider(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform assert_platform_admin();
  insert into providers (name, nip, phone, email, city)
  values (trim(p->>'name'), regexp_replace(p->>'nip', '[^0-9]', '', 'g'), trim(p->>'phone'), lower(trim(p->>'email')), trim(p->>'city'))
  returning id into v;
  perform admin_log('dodanie usługodawcy', v::text);
  return v;
exception when unique_violation then
  raise exception 'Usługodawca z tym NIP-em już jest w Ostoi' using errcode = 'P0001';
end $$;
revoke all on function public.admin_create_provider(jsonb) from public;
grant execute on function public.admin_create_provider(jsonb) to authenticated;

create or replace function public.admin_providers()
returns table (id uuid, name text, nip text, phone text, email text, city text, verified_at timestamptz,
               cemetery_ids uuid[], members int, open_visits int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select p.id, p.name, p.nip, p.phone, p.email, p.city, p.verified_at,
           coalesce((select array_agg(pc.cemetery_id) from provider_cemeteries pc where pc.provider_id = p.id), '{}'),
           (select count(*)::int from provider_members m where m.provider_id = p.id),
           (select count(*)::int from grave_visits v where v.provider_id = p.id and v.status = 'zaplanowana')
    from providers p order by p.created_at desc;
end $$;
revoke all on function public.admin_providers() from public;
grant execute on function public.admin_providers() to authenticated;

create or replace function public.admin_update_provider(p_provider uuid, p_verified boolean, p_cemeteries uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  update providers set verified_at = case when p_verified then coalesce(verified_at, now()) end where id = p_provider;
  if not found then
    raise exception 'Nie znaleziono usługodawcy.' using errcode = 'P0001';
  end if;
  delete from provider_cemeteries where provider_id = p_provider and not (cemetery_id = any(coalesce(p_cemeteries, '{}')));
  insert into provider_cemeteries (provider_id, cemetery_id)
  select p_provider, c from unnest(coalesce(p_cemeteries, '{}')) c
  on conflict do nothing;
  perform admin_log('zmiana usługodawcy', p_provider::text);
end $$;
revoke all on function public.admin_update_provider(uuid, boolean, uuid[]) from public;
grant execute on function public.admin_update_provider(uuid, boolean, uuid[]) to authenticated;

create or replace function public.admin_invite_provider(p_provider uuid, p_email text, p_name text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
begin
  perform assert_platform_admin();
  if not exists (select 1 from providers where id = p_provider) then
    raise exception 'Nie znaleziono usługodawcy.' using errcode = 'P0001';
  end if;
  update invitations set revoked_at = now()
  where provider_id = p_provider and email = lower(trim(p_email)) and accepted_at is null and revoked_at is null;
  insert into invitations (provider_id, email, role, display_name, token_hash, invited_by)
  values (p_provider, lower(trim(p_email)), 'wlasciciel', trim(p_name), encode(digest(v_token, 'sha256'), 'hex'), auth.uid());
  perform admin_log('zaproszenie usługodawcy', p_provider::text);
  return v_token;
end $$;
revoke all on function public.admin_invite_provider(uuid, text, text) from public;
grant execute on function public.admin_invite_provider(uuid, text, text) to authenticated;
