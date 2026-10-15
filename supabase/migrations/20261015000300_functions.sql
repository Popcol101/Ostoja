-- Ostoja: logika w bazie — wyceny, rozsyłanie zapytań, przyjęcie, wygasanie,
-- dostęp rodziny przez token, strona pamięci, kalendarz i rozliczenia.

alter table price_catalog add column optional boolean not null default false;

-- Pomocnicze --------------------------------------------------------------

create or replace function public.distance_km(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns numeric language sql immutable as $$
  select round((6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))::numeric, 1)
$$;

-- Wycena podstawowa w standardzie Ostoi. "nie_wiem" liczymy jak pochówek tradycyjny.
-- Zwraca null, gdy zakład nie uzupełnił którejś z wymaganych pozycji.
create or replace function public.quote_for(p_home uuid, p_burial burial_type, p_ceremony ceremony_type)
returns numeric language sql stable security definer set search_path = public as $$
  with required as (
    select c.item_key from price_catalog c
    where not c.optional
      and (c.for_burial = 'wszystkie'
           or c.for_burial = case when p_burial = 'nie_wiem' then 'tradycyjny' else p_burial::text end)
      and (not c.needs_ceremony or p_ceremony <> 'bez')
  )
  select case when count(p.item_key) = (select count(*) from required)
              then sum(p.price_pln) end
  from required r left join price_items p on p.item_key = r.item_key and p.home_id = p_home
$$;

-- Lista ofert dla rodziny (przed wysłaniem zapytania) ----------------------

create or replace function public.search_homes(p_city text, p_burial burial_type,
                                               p_ceremony ceremony_type, p_sort text default 'odleglosc')
returns table (home_id uuid, slug text, name text, address text, distance_km numeric,
               rating numeric, reviews_count int, has_farewell_hall boolean,
               available_today boolean, quote_pln numeric, left_from_benefit numeric)
language sql stable security definer set search_path = public as $$
  select h.id, h.slug, h.name, h.address,
         distance_km(c.lat, c.lng, h.lat, h.lng) as dist,
         h.rating, h.reviews_count, h.has_farewell_hall, h.accepting_today,
         q.quote, 7000 - q.quote
  from cities c
  join funeral_homes h on h.verified_at is not null
  cross join lateral (select quote_for(h.id, p_burial, p_ceremony) as quote) q
  where c.slug = p_city
    and q.quote is not null
    and distance_km(c.lat, c.lng, h.lat, h.lng) <= h.service_radius_km
  -- Kolejności nie da się kupić: tylko odległość, cena albo oceny.
  order by
    case when p_sort = 'cena' then q.quote end asc,
    case when p_sort = 'oceny' then h.rating end desc nulls last,
    dist asc, h.name
$$;

create or replace function public.home_price_list(p_home uuid, p_burial burial_type, p_ceremony ceremony_type)
returns table (item_key text, label text, price_pln numeric, optional boolean)
language sql stable security definer set search_path = public as $$
  select c.item_key, c.label, p.price_pln, c.optional
  from price_catalog c
  join price_items p on p.item_key = c.item_key and p.home_id = p_home
  join funeral_homes h on h.id = p_home and h.verified_at is not null
  where (c.for_burial = 'wszystkie'
         or c.for_burial = case when p_burial = 'nie_wiem' then 'tradycyjny' else p_burial::text end)
    and (not c.needs_ceremony or p_ceremony <> 'bez')
  order by c.optional, c.sort_order
$$;

-- Rozsyłanie zapytania ----------------------------------------------------
-- Runda 1: tylko zakład wybrany przez rodzinę (jeśli wybrała), inaczej 3 najbliższe.
-- Kolejne rundy: 3 najbliższe zakłady, które jeszcze nie dostały zapytania.

create or replace function public.dispatch_offers(p_inquiry uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_inq inquiries%rowtype;
  v_city cities%rowtype;
  v_count int := 0;
begin
  select * into v_inq from inquiries where id = p_inquiry for update;
  select * into v_city from cities where slug = v_inq.city_slug;

  if v_inq.dispatch_round = 1 and v_inq.preferred_home_id is not null then
    insert into offers (inquiry_id, home_id, quote_pln, distance_km, round)
    select v_inq.id, h.id, quote_for(h.id, v_inq.burial, v_inq.ceremony),
           distance_km(v_city.lat, v_city.lng, h.lat, h.lng), 1
    from funeral_homes h
    where h.id = v_inq.preferred_home_id and h.verified_at is not null and h.accepting_today
      and quote_for(h.id, v_inq.burial, v_inq.ceremony) is not null
    on conflict do nothing;
  else
    insert into offers (inquiry_id, home_id, quote_pln, distance_km, round)
    select v_inq.id, h.id, quote_for(h.id, v_inq.burial, v_inq.ceremony),
           distance_km(v_city.lat, v_city.lng, h.lat, h.lng), v_inq.dispatch_round
    from funeral_homes h
    where h.verified_at is not null and h.accepting_today
      and quote_for(h.id, v_inq.burial, v_inq.ceremony) is not null
      and distance_km(v_city.lat, v_city.lng, h.lat, h.lng) <= h.service_radius_km
      and not exists (select 1 from offers o where o.inquiry_id = v_inq.id and o.home_id = h.id)
    order by distance_km(v_city.lat, v_city.lng, h.lat, h.lng)
    limit 3
    on conflict do nothing;
  end if;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    update inquiries set status = 'do_opiekuna' where id = v_inq.id;
  end if;
  return v_count;
end $$;
revoke all on function public.dispatch_offers(uuid) from public;

-- Rodzina wysyła zapytanie (strona dla rodzin, bez logowania).
create or replace function public.create_inquiry(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from cities where slug = p->>'city_slug') then
    raise exception 'Nieznane miasto' using errcode = '22023';
  end if;

  insert into inquiries (city_slug, burial, ceremony, place_of_death, budget, guests_estimate,
                         contact_name, contact_phone, preferred_home_id)
  values (p->>'city_slug',
          (p->>'burial')::burial_type,
          (p->>'ceremony')::ceremony_type,
          (p->>'place_of_death')::place_of_death,
          nullif(p->>'budget', ''),
          nullif(p->>'guests_estimate', '')::int,
          trim(p->>'contact_name'),
          regexp_replace(p->>'contact_phone', '[^0-9+ ]', '', 'g'),
          (select id from funeral_homes where id = nullif(p->>'preferred_home_id', '')::uuid
             and verified_at is not null))
  returning id into v_id;

  perform dispatch_offers(v_id);
  return v_id;
end $$;
revoke all on function public.create_inquiry(jsonb) from public;
grant execute on function public.create_inquiry(jsonb) to anon, authenticated;

-- Wygasanie ofert po 15 minutach i przekazanie dalej (pg_cron co minutę albo przy odczycie skrzynki).
create or replace function public.expire_offers()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_expired int;
  r record;
begin
  update offers set status = 'wygasle', responded_at = now()
  where status = 'nowe' and expires_at <= now();
  get diagnostics v_expired = row_count;

  for r in
    select i.id, i.dispatch_round from inquiries i
    where i.status = 'otwarte'
      and not exists (select 1 from offers o where o.inquiry_id = i.id and o.status in ('nowe', 'przyjete'))
    for update skip locked
  loop
    if r.dispatch_round >= 3 then
      update inquiries set status = 'do_opiekuna' where id = r.id;
    else
      update inquiries set dispatch_round = dispatch_round + 1 where id = r.id;
      perform dispatch_offers(r.id);
    end if;
  end loop;

  return v_expired;
end $$;
revoke all on function public.expire_offers() from public;
grant execute on function public.expire_offers() to service_role;

-- Skrzynka zakładu: bez danych kontaktowych rodziny.
create or replace function public.get_inbox()
returns table (offer_id uuid, status offer_status, sent_at timestamptz, expires_at timestamptz,
               quote_pln numeric, distance_km numeric, city_name text, burial burial_type,
               ceremony ceremony_type, place_of_death place_of_death, budget text,
               guests_estimate int, order_id uuid, home_id uuid)
language plpgsql volatile security definer set search_path = public as $$
begin
  perform expire_offers();
  return query
    select o.id, o.status, o.sent_at, o.expires_at, o.quote_pln, o.distance_km, c.name,
           i.burial, i.ceremony, i.place_of_death, i.budget, i.guests_estimate,
           (select ord.id from orders ord where ord.offer_id = o.id), o.home_id
    from offers o
    join inquiries i on i.id = o.inquiry_id
    join cities c on c.slug = i.city_slug
    where o.home_id in (select my_homes())
    order by (o.status = 'nowe') desc, o.sent_at desc
    limit 50;
end $$;
revoke all on function public.get_inbox() from public;
grant execute on function public.get_inbox() to authenticated;

-- Przyjęcie zapytania: dopiero tu zakład dostaje kontakt do rodziny.
create or replace function public.accept_offer(p_offer uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_offer offers%rowtype;
  v_inq inquiries%rowtype;
  v_order uuid;
begin
  select * into v_offer from offers where id = p_offer for update;
  if not found or v_offer.home_id not in (select my_homes()) then
    raise exception 'Brak dostępu do zapytania' using errcode = '42501';
  end if;
  if v_offer.status <> 'nowe' or v_offer.expires_at <= now() then
    raise exception 'Zapytanie nie jest już aktywne' using errcode = 'P0001';
  end if;

  select * into v_inq from inquiries where id = v_offer.inquiry_id for update;
  if v_inq.status <> 'otwarte' then
    raise exception 'Zapytanie przyjął już inny zakład' using errcode = 'P0001';
  end if;

  update offers set status = 'przyjete', responded_at = now() where id = v_offer.id;
  update offers set status = 'zamkniete', responded_at = now()
    where inquiry_id = v_inq.id and id <> v_offer.id and status = 'nowe';
  update inquiries set status = 'przyjete' where id = v_inq.id;

  insert into orders (home_id, offer_id, burial, ceremony, principal_name, principal_phone,
                      selected_items, total_pln)
  values (v_offer.home_id, v_offer.id, v_inq.burial, v_inq.ceremony,
          v_inq.contact_name, v_inq.contact_phone,
          coalesce((select array_agg(item_key) from home_price_list(v_offer.home_id, v_inq.burial, v_inq.ceremony)
                    where not optional), '{}'),
          v_offer.quote_pln)
  returning id into v_order;

  insert into order_tasks (order_id, home_id, title, sort_order) values
    (v_order, v_offer.home_id, 'Zadzwonić do rodziny', 1),
    (v_order, v_offer.home_id, 'Wysłać rodzinie link do formularza', 2),
    (v_order, v_offer.home_id, 'Ustalić termin odbioru', 3),
    (v_order, v_offer.home_id, 'Zarezerwować termin ceremonii', 4),
    (v_order, v_offer.home_id, 'Podpisać umowę', 5);

  return v_order;
end $$;
revoke all on function public.accept_offer(uuid) from public;
grant execute on function public.accept_offer(uuid) to authenticated;

create or replace function public.decline_offer(p_offer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_offer offers%rowtype;
begin
  select * into v_offer from offers where id = p_offer for update;
  if not found or v_offer.home_id not in (select my_homes()) then
    raise exception 'Brak dostępu do zapytania' using errcode = '42501';
  end if;
  if v_offer.status <> 'nowe' then
    raise exception 'Zapytanie nie jest już aktywne' using errcode = 'P0001';
  end if;
  update offers set status = 'odrzucone', responded_at = now() where id = p_offer;
  perform expire_offers();  -- jeśli nikt inny nie ma już aktywnej oferty, zapytanie idzie dalej
end $$;
revoke all on function public.decline_offer(uuid) from public;
grant execute on function public.decline_offer(uuid) to authenticated;

-- Zmiany w zleceniu: umowa i suma ---------------------------------------------

create or replace function public.orders_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.contract_signed_at is not null and new.contract_signed_at is distinct from old.contract_signed_at then
    raise exception 'Umowa jest już podpisana' using errcode = 'P0001';
  end if;
  if new.contract_signed_at is not null and old.contract_signed_at is null and new.stage = 'przyjete' then
    new.stage := 'umowa';
  end if;
  if old.contract_signed_at is not null and new.selected_items is distinct from old.selected_items then
    raise exception 'Po podpisaniu umowy zakres usług zmienia się aneksem' using errcode = 'P0001';
  end if;
  if new.selected_items is distinct from old.selected_items then
    new.total_pln := (select sum(price_pln) from price_items
                      where home_id = new.home_id and item_key = any(new.selected_items));
  end if;
  return new;
end $$;
create trigger orders_before_update before update on orders
  for each row execute function public.orders_before_update();

-- Link dla rodziny (bez logowania, przez token) -----------------------------

create or replace function public.family_get_order(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'order_id', o.id,
    'stage', o.stage,
    'home', jsonb_build_object('name', h.name, 'phone', h.phone, 'address', h.address),
    'burial', o.burial, 'ceremony', o.ceremony,
    'deceased_first_name', o.deceased_first_name, 'deceased_last_name', o.deceased_last_name,
    'born_on', o.born_on, 'died_at', o.died_at,
    'principal_name', o.principal_name, 'principal_email', o.principal_email,
    'zus_bank_account', o.zus_bank_account,
    'selected_items', o.selected_items, 'total_pln', o.total_pln,
    'family_consents', o.family_consents,
    'contract_signed', o.contract_signed_at is not null,
    'price_list', (select coalesce(jsonb_agg(to_jsonb(pl)), '[]')
                   from home_price_list(o.home_id, o.burial, o.ceremony) pl),
    'events', (select coalesce(jsonb_agg(jsonb_build_object(
                  'kind', e.kind, 'title', e.title, 'status', e.status,
                  'starts_at', lower(e.during), 'place', e.place) order by lower(e.during)), '[]')
               from events e where e.order_id = o.id and e.status <> 'odwolany')
  )
  from orders o join funeral_homes h on h.id = o.home_id
  where o.family_token = p_token and o.family_token_until > now()
$$;
revoke all on function public.family_get_order(text) from public;
grant execute on function public.family_get_order(text) to anon, authenticated;

-- Rodzina może zmienić tylko pola z tej listy.
create or replace function public.family_update_order(p_token text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_allowed text[] := array['deceased_first_name', 'deceased_last_name', 'born_on', 'died_at',
                            'principal_email', 'zus_bank_account', 'selected_items', 'family_consents'];
  v_key text;
begin
  select * into v_order from orders
  where family_token = p_token and family_token_until > now() for update;
  if not found then
    raise exception 'Link wygasł lub jest nieprawidłowy' using errcode = '42501';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if not v_key = any(v_allowed) then
      raise exception 'Pole % nie może być zmienione przez rodzinę', v_key using errcode = '42501';
    end if;
  end loop;

  update orders set
    deceased_first_name = case when p_patch ? 'deceased_first_name' then nullif(trim(p_patch->>'deceased_first_name'), '') else deceased_first_name end,
    deceased_last_name  = case when p_patch ? 'deceased_last_name'  then nullif(trim(p_patch->>'deceased_last_name'), '') else deceased_last_name end,
    born_on             = case when p_patch ? 'born_on' then nullif(p_patch->>'born_on', '')::date else born_on end,
    died_at             = case when p_patch ? 'died_at' then nullif(p_patch->>'died_at', '')::timestamptz else died_at end,
    principal_email     = case when p_patch ? 'principal_email' then nullif(trim(p_patch->>'principal_email'), '') else principal_email end,
    zus_bank_account    = case when p_patch ? 'zus_bank_account' then nullif(regexp_replace(p_patch->>'zus_bank_account', '[^0-9]', '', 'g'), '') else zus_bank_account end,
    selected_items      = case when p_patch ? 'selected_items'
                               then (select coalesce(array_agg(pl.item_key), '{}')
                                     from home_price_list(home_id, burial, ceremony) pl
                                     where not pl.optional
                                        or pl.item_key in (select jsonb_array_elements_text(p_patch->'selected_items')))
                               else selected_items end,
    family_consents     = case when p_patch ? 'family_consents' then family_consents || (p_patch->'family_consents') else family_consents end,
    family_updated_at   = now()
  where id = v_order.id;

  return family_get_order(p_token);
end $$;
revoke all on function public.family_update_order(text, jsonb) from public;
grant execute on function public.family_update_order(text, jsonb) to anon, authenticated;

-- Strona pamięci (publiczna, tylko po opublikowaniu) -------------------------

create or replace function public.public_memorial(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'first_name', o.deceased_first_name, 'last_name', o.deceased_last_name,
    'born_year', extract(year from o.born_on)::int,
    'died_year', extract(year from o.died_at at time zone 'Europe/Warsaw')::int,
    'note', o.memorial_note, 'ceremony', o.ceremony, 'home_name', h.name,
    'events', (select coalesce(jsonb_agg(jsonb_build_object(
                  'title', e.title, 'starts_at', lower(e.during), 'place', e.place)
                  order by lower(e.during)), '[]')
               from events e
               where e.order_id = o.id and e.status <> 'odwolany' and e.kind in ('ceremonia', 'pochowek'))
  )
  from orders o join funeral_homes h on h.id = o.home_id
  where o.memorial_slug = p_slug and o.memorial_published
$$;
revoke all on function public.public_memorial(text) from public;
grant execute on function public.public_memorial(text) to anon, authenticated;

-- Kalendarz: rezerwacje zasobów idą za wydarzeniem ---------------------------

create or replace function public.bookings_fill()
returns trigger language plpgsql set search_path = public as $$
declare
  v_event events%rowtype;
begin
  select * into v_event from events where id = new.event_id;
  if v_event.status = 'odwolany' then
    raise exception 'Nie można zarezerwować zasobu dla odwołanego wydarzenia' using errcode = 'P0001';
  end if;
  new.during := v_event.during;
  new.home_id := v_event.home_id;
  return new;
end $$;
create trigger bookings_fill before insert or update on bookings
  for each row execute function public.bookings_fill();

create or replace function public.events_sync_bookings()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'odwolany' then
    delete from bookings where event_id = new.id;
  elsif new.during is distinct from old.during then
    update bookings set during = new.during where event_id = new.id;
  end if;
  return new;
end $$;
create trigger events_sync_bookings after update of during, status on events
  for each row execute function public.events_sync_bookings();

-- Widok kalendarza z ostrzeżeniem o regule 24 godzin (z wyjątkami ustawowymi:
-- to ostrzeżenie, nie blokada).
create view public.calendar_events with (security_invoker = true) as
select e.id, e.home_id, e.order_id, e.kind, e.title, e.status, e.during,
       lower(e.during) as starts_at, upper(e.during) as ends_at, e.place, e.assignee, e.notes,
       coalesce((select array_agg(r.name order by r.name) from bookings b
                 join resources r on r.id = b.resource_id where b.event_id = e.id), '{}') as resource_names,
       case when e.kind in ('pochowek', 'kremacja') and o.died_at is not null
                 and lower(e.during) < o.died_at + interval '24 hours'
            then 'Pochówek wcześniej niż 24 godziny od zgonu' end as warning,
       nullif(trim(coalesce(o.deceased_first_name, '') || ' ' || coalesce(o.deceased_last_name, '')), '') as deceased_name
from events e left join orders o on o.id = e.order_id;
grant select on public.calendar_events to authenticated;

-- Rozliczenia z Ostoją: 250 zł netto za zlecenie z podpisaną umową, tylko zlecenia z Ostoi.
create view public.billing_lines with (security_invoker = true) as
select o.id as order_id, o.home_id, o.contract_signed_at,
       date_trunc('month', o.contract_signed_at at time zone 'Europe/Warsaw')::date as billing_month,
       nullif(trim(coalesce(o.deceased_first_name, '') || ' ' || coalesce(o.deceased_last_name, '')), '') as deceased_name,
       250.00::numeric(10,2) as fee_net_pln
from orders o
where o.contract_signed_at is not null and o.offer_id is not null;
grant select on public.billing_lines to authenticated;
