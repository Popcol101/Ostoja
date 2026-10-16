-- Klepsydra: pola, których nie ma w zleceniu (forma, nazwisko rodowe, miejsca w treści, prośby, podpis),
-- i publikacja w sieci. Treść składa aplikacja (src/lib/obituary.ts) z tych pól, zlecenia i kalendarza.
-- Publikacja tylko za potwierdzoną zgodą rodziny; adres z losową końcówką (nie da się zgadnąć klepsydr innych osób);
-- klepsydra znika z sieci 30 dni po ostatniej uroczystości. Publicznie: bez telefonu, e-maila i danych rodziny,
-- bez pełnej daty urodzenia (tylko wiek).

create table public.obituaries (
  order_id          uuid primary key references public.orders (id) on delete cascade,
  home_id           uuid not null references public.funeral_homes (id) on delete cascade,
  gender            text not null check (gender in ('k', 'm')),
  -- Rodzaj klepsydry; puste = jak ceremonia w zleceniu.
  style             text check (style in ('religijna', 'swiecka', 'bez')),
  maiden_name       text check (length(maiden_name) <= 80),
  description       text check (length(description) <= 200),
  sacraments        boolean not null default false,
  symbol            text check (symbol in ('krzyz', 'galazka', 'brak')),
  private_funeral   boolean not null default false,
  ceremony_place    text check (length(ceremony_place) <= 160),
  cemetery_place    text check (length(cemetery_place) <= 160),
  rosary            text check (length(rosary) <= 300),
  request           text check (length(request) <= 300),
  signature         text check (length(signature) <= 200),
  public_slug       text unique check (public_slug ~ '^[a-z0-9-]{3,80}$'),
  published_at      timestamptz,
  family_consent_at timestamptz,
  updated_at        timestamptz not null default now()
);
alter table public.obituaries enable row level security;
revoke all on public.obituaries from anon, authenticated;
grant select, insert, update on public.obituaries to authenticated;

-- Cały zespół widzi (druk); zmienia właściciel i biuro, tylko w zleceniach swojego zakładu.
create policy obituaries_read on public.obituaries for select to authenticated
  using (home_id in (select my_homes()));
create policy obituaries_insert on public.obituaries for insert to authenticated
  with check (home_id in (select my_admin_homes())
              and exists (select 1 from orders o where o.id = order_id and o.home_id = obituaries.home_id));
create policy obituaries_update on public.obituaries for update to authenticated
  using (home_id in (select my_admin_homes()))
  with check (home_id in (select my_admin_homes())
              and exists (select 1 from orders o where o.id = order_id and o.home_id = obituaries.home_id));

-- Publikacja i adres zmieniają się tylko przez publish_obituary.
create or replace function public.obituaries_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_setting('ostoja.publish', true) is distinct from 'tak' then
    new.public_slug := old.public_slug;
    new.published_at := old.published_at;
    new.family_consent_at := old.family_consent_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger obituaries_guard before update on public.obituaries
  for each row execute function public.obituaries_guard();

create or replace function public.obituaries_guard_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  new.public_slug := null;
  new.published_at := null;
  new.family_consent_at := null;
  return new;
end $$;
create trigger obituaries_guard_insert before insert on public.obituaries
  for each row execute function public.obituaries_guard_insert();

-- Publikacja (p_publish) albo wycofanie. p_base: początek adresu z imienia i nazwiska (aplikacja usuwa polskie znaki).
create or replace function public.publish_obituary(p_order uuid, p_publish boolean, p_consent boolean, p_base text)
returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_ob obituaries%rowtype;
  v_order orders%rowtype;
  v_slug text;
  v_try int := 0;
begin
  select * into v_order from orders where id = p_order;
  if not found or v_order.home_id not in (select my_admin_homes()) then
    raise exception 'Klepsydrę publikuje właściciel albo biuro zakładu' using errcode = '42501';
  end if;
  select * into v_ob from obituaries where order_id = p_order for update;
  if not found then
    raise exception 'Najpierw zapisz klepsydrę' using errcode = 'P0001';
  end if;
  perform set_config('ostoja.publish', 'tak', true);
  if not p_publish then
    update obituaries set published_at = null where order_id = p_order;
    return v_ob.public_slug;
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Potwierdź, że rodzina zgodziła się na publikację klepsydry' using errcode = 'P0001';
  end if;
  if v_order.deceased_last_name is null or v_order.died_at is null then
    raise exception 'Uzupełnij imię, nazwisko i datę zgonu przed publikacją' using errcode = 'P0001';
  end if;
  v_slug := v_ob.public_slug;
  while v_slug is null loop
    v_try := v_try + 1;
    v_slug := left(coalesce(nullif(regexp_replace(lower(coalesce(p_base, '')), '[^a-z0-9-]+', '-', 'g'), ''), 'klepsydra'), 60)
              || '-' || substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyzabc'), 1, 6);
    v_slug := regexp_replace(regexp_replace(v_slug, '-+', '-', 'g'), '^-', '');
    if v_slug !~ '^[a-z0-9-]{3,80}$' or exists (select 1 from obituaries where public_slug = v_slug) then
      v_slug := null;
      if v_try > 5 then
        raise exception 'Nie udało się przygotować adresu klepsydry' using errcode = 'P0001';
      end if;
    end if;
  end loop;
  update obituaries set public_slug = v_slug, published_at = coalesce(published_at, now()), family_consent_at = now()
  where order_id = p_order;
  return v_slug;
end $$;

-- Czy opublikowana klepsydra jest jeszcze w sieci (30 dni po ostatniej uroczystości albo po publikacji).
create or replace function public.obituary_visible(p_order uuid, p_published timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select p_published is not null and now() < coalesce(
    (select max(upper(e.during)) from events e
     where e.order_id = p_order and e.status <> 'odwolany' and e.kind in ('ceremonia', 'pochowek')),
    p_published) + interval '30 days'
$$;

-- Publiczna klepsydra (strona /klepsydra/[adres] i obraz do udostępnień).
create or replace function public.public_obituary(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ceremony', coalesce(b.style, o.ceremony::text), 'burial', o.burial, 'gender', b.gender,
    'first_name', o.deceased_first_name, 'last_name', o.deceased_last_name, 'maiden_name', b.maiden_name,
    'age', case when o.born_on is not null and o.died_at is not null
                then extract(year from age((o.died_at at time zone 'Europe/Warsaw')::date, o.born_on))::int end,
    'died_at', o.died_at,
    'description', b.description, 'sacraments', b.sacraments, 'symbol', b.symbol, 'private_funeral', b.private_funeral,
    'ceremony_place', b.ceremony_place, 'cemetery_place', b.cemetery_place,
    'rosary', b.rosary, 'request', b.request, 'signature', b.signature,
    'home_name', h.name, 'home_phone', h.phone,
    'memorial_slug', case when o.memorial_published then o.memorial_slug end,
    'events', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'starts_at', lower(e.during), 'place', e.place)
                                         order by lower(e.during))
                        from events e
                        where e.order_id = o.id and e.status <> 'odwolany' and e.kind in ('ceremonia', 'pochowek')), '[]')
  )
  from obituaries b
  join orders o on o.id = b.order_id
  join funeral_homes h on h.id = o.home_id
  where p_slug ~ '^[a-z0-9-]{3,80}$' and b.public_slug = p_slug and obituary_visible(o.id, b.published_at)
$$;

-- Link dla rodziny: jak w migracji 300, plus adres opublikowanej klepsydry.
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
               from events e where e.order_id = o.id and e.status <> 'odwolany'),
    'obituary_slug', (select b.public_slug from obituaries b
                      where b.order_id = o.id and obituary_visible(o.id, b.published_at))
  )
  from orders o join funeral_homes h on h.id = o.home_id
  where o.family_token = p_token and o.family_token_until > now()
$$;

revoke all on function public.publish_obituary(uuid, boolean, boolean, text), public.obituary_visible(uuid, timestamptz),
  public.public_obituary(text), public.obituaries_guard(), public.obituaries_guard_insert() from public, anon, authenticated;
grant execute on function public.publish_obituary(uuid, boolean, boolean, text) to authenticated;
grant execute on function public.public_obituary(text) to anon, authenticated;
grant execute on function public.family_get_order(text) to anon, authenticated;
