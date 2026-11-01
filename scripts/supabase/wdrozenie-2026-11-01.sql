-- Wdrożenie z 1.11.2026 na projekcie Supabase: oceny, magazyn, faktury, wniosek Z-12, opieka nad grobem.
-- Uruchom RAZ w Supabase → SQL Editor → New query: wklej cały plik i kliknij Run.
-- Całość jest w jednej transakcji: albo wszystko się uda, albo nic się nie zmieni.
-- Zawiera też migrację 20261018000100 (uprawnienia do kolumn) – można ją uruchomić ponownie bez szkody.
-- Nie zawiera danych testowych (zakładu Cisza, usługodawcy testowego) – te są tylko w supabase/seed.sql.

begin;

-- ===================== 20261018000100_column_privileges.sql =====================
-- Uprawnienia do kolumn zamiast do całych tabel (przegląd bezpieczeństwa 18.10.2026).
-- 1) Zakład zmieniał w funeral_homes także verified_at, rating i reviews_count – mógł sam się zweryfikować,
--    wrócić na listę ofert po wstrzymaniu i poprawić sobie oceny (a oceny decydują o kolejności ofert).
-- 2) Każdy członek zespołu zmieniał w orders także offer_id, home_id, zgody rodziny i token linku dla rodziny –
--    np. usunięcie offer_id wyjmowało podpisane zlecenie z rozliczeń Ostoi.
-- Zostają tylko kolumny, które panel naprawdę zmienia. Pozostałe zmieniają funkcje security definer
-- (weryfikacja, wstrzymanie, link dla rodziny), które same sprawdzają uprawnienia.

revoke update on public.funeral_homes from authenticated;
grant update (phone, email, address, description, service_radius_km, has_farewell_hall, accepting_today)
  on public.funeral_homes to authenticated;

revoke insert, update on public.orders from authenticated;
grant update (stage, deceased_first_name, deceased_last_name, born_on, died_at, notes, contract_signed_at,
              memorial_slug, memorial_published, memorial_note)
  on public.orders to authenticated;

-- ===================== 20261101000100_reviews.sql =====================
-- Oceny od rodzin. Ocenę wystawia tylko rodzina z linku do zlecenia (bez konta), po ceremonii lub pochówku
-- albo gdy zlecenie jest w rozliczeniu. Jedna ocena na zlecenie, rodzina może ją zmienić, dopóki link działa.
-- Średnia i liczba ocen w funeral_homes liczą się triggerem z ocen widocznych (zakład nie zmieni ich sam –
-- kolumny rating i reviews_count są poza uprawnieniami authenticated od migracji 20261018000100).
-- Komentarz widzi tylko zakład i administrator Ostoi; publicznie: średnia i liczba ocen.

create table public.home_reviews (
  order_id      uuid primary key references public.orders (id) on delete cascade,
  home_id       uuid not null references public.funeral_homes (id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  comment       text check (length(comment) <= 1000),
  hidden_at     timestamptz,
  hidden_reason text check (length(hidden_reason) <= 300),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index home_reviews_home_idx on public.home_reviews (home_id, created_at desc);

alter table public.home_reviews enable row level security;
revoke all on public.home_reviews from anon, authenticated;
grant select on public.home_reviews to authenticated;
create policy home_reviews_read on public.home_reviews for select to authenticated
  using (home_id in (select my_homes()));

-- Średnia z ocen widocznych ---------------------------------------------------

create or replace function public.recompute_home_rating(p_home uuid) returns void
language sql security definer set search_path = public as $$
  update funeral_homes h set
    rating = s.avg_rating,
    reviews_count = s.cnt
  from (select round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as cnt
        from home_reviews where home_id = p_home and hidden_at is null) s
  where h.id = p_home
$$;
revoke all on function public.recompute_home_rating(uuid) from public;

create or replace function public.home_reviews_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_home_rating(coalesce(new.home_id, old.home_id));
  return null;
end $$;
revoke all on function public.home_reviews_after() from public;
create trigger home_reviews_after after insert or update or delete on public.home_reviews
  for each row execute function public.home_reviews_after();

-- Kiedy rodzina może ocenić ----------------------------------------------------

create or replace function public.review_eligible(p_order uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders o
    where o.id = p_order
      and o.contract_signed_at is not null
      and (o.stage in ('rozliczenie', 'zamkniete')
           or exists (select 1 from events e
                      where e.order_id = o.id and e.kind in ('ceremonia', 'pochowek')
                        and e.status <> 'odwolany' and upper(e.during) < now()))
  )
$$;
revoke all on function public.review_eligible(uuid) from public;

-- Rodzina (anon, przez token) ---------------------------------------------------

create or replace function public.family_review(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'eligible', review_eligible(o.id),
    'home_name', h.name,
    'rating', r.rating,
    'comment', r.comment,
    'submitted_at', r.updated_at
  )
  from orders o
  join funeral_homes h on h.id = o.home_id
  left join home_reviews r on r.order_id = o.id
  where o.family_token = p_token and o.family_token_until > now()
$$;
revoke all on function public.family_review(text) from public;
grant execute on function public.family_review(text) to anon, authenticated;

create or replace function public.family_submit_review(p_token text, p_rating int, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  select * into v_order from orders
  where family_token = p_token and family_token_until > now();
  if not found then
    raise exception 'Link wygasł lub jest nieprawidłowy' using errcode = '42501';
  end if;
  if not review_eligible(v_order.id) then
    raise exception 'Ocenę można wystawić po ceremonii lub pochówku.' using errcode = 'P0001';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Wybierz ocenę od 1 do 5.' using errcode = 'P0001';
  end if;
  if length(v_comment) > 1000 then
    raise exception 'Komentarz może mieć najwyżej 1000 znaków.' using errcode = 'P0001';
  end if;

  insert into home_reviews (order_id, home_id, rating, comment)
  values (v_order.id, v_order.home_id, p_rating, v_comment)
  on conflict (order_id) do update
    set rating = excluded.rating, comment = excluded.comment, updated_at = now();

  return family_review(p_token);
end $$;
revoke all on function public.family_submit_review(text, int, text) from public;
grant execute on function public.family_submit_review(text, int, text) to anon, authenticated;

-- Administrator Ostoi: lista i ukrywanie (np. obraźliwy komentarz) ---------------------

create or replace function public.admin_reviews()
returns table (order_id uuid, home_id uuid, home_name text, rating smallint, comment text,
               hidden_at timestamptz, hidden_reason text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select r.order_id, r.home_id, h.name, r.rating, r.comment, r.hidden_at, r.hidden_reason, r.created_at, r.updated_at
    from home_reviews r join funeral_homes h on h.id = r.home_id
    order by r.updated_at desc
    limit 200;
end $$;
revoke all on function public.admin_reviews() from public;
grant execute on function public.admin_reviews() to authenticated;

create or replace function public.admin_set_review_hidden(p_order uuid, p_hidden boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  if p_hidden and length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Podaj powód ukrycia oceny.' using errcode = 'P0001';
  end if;
  update home_reviews
     set hidden_at = case when p_hidden then now() end,
         hidden_reason = case when p_hidden then trim(p_reason) end
   where order_id = p_order;
  if not found then
    raise exception 'Nie ma takiej oceny.' using errcode = 'P0001';
  end if;
  perform admin_log(case when p_hidden then 'ukrycie oceny' else 'przywrócenie oceny' end, p_order::text);
end $$;
revoke all on function public.admin_set_review_hidden(uuid, boolean, text) from public;
grant execute on function public.admin_set_review_hidden(uuid, boolean, text) to authenticated;

-- ===================== 20261101000200_stock.sql =====================
-- Prosty magazyn trumien i urn. Zakład prowadzi własną listę produktów ze stanem; przypisanie produktu do zlecenia
-- zdejmuje go ze stanu, usunięcie z zlecenia oddaje na stan. Każda zmiana stanu trafia do historii ruchów.
-- Stan nie może spaść poniżej zera (check) – „Brak na stanie” zamiast ujemnych liczb.
-- Uprawnienia: cały zespół widzi; produkty, dostawy i korekty zmienia właściciel i biuro; do zlecenia
-- przypisuje właściciel i biuro (ekipa wydaje towar fizycznie, ale nie zmienia zapisów).

create type public.stock_kind as enum ('trumna', 'urna', 'inne');
create type public.stock_reason as enum ('dostawa', 'zlecenie', 'zwrot', 'korekta');

create table public.stock_items (
  id          uuid primary key default gen_random_uuid(),
  home_id     uuid not null references public.funeral_homes (id) on delete cascade,
  kind        public.stock_kind not null,
  name        text not null check (length(trim(name)) between 2 and 120),
  material    text check (length(material) <= 120),
  supplier    text check (length(supplier) <= 120),
  sku         text check (length(sku) <= 60),
  price_pln   numeric(10,2) not null check (price_pln between 0 and 100000),
  qty         int not null default 0 check (qty >= 0),
  min_qty     int not null default 0 check (min_qty between 0 and 1000),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index stock_items_home_idx on public.stock_items (home_id, kind, name);

create table public.order_items (
  order_id       uuid not null references public.orders (id) on delete cascade,
  stock_item_id  uuid not null references public.stock_items (id),
  home_id        uuid not null references public.funeral_homes (id) on delete cascade,
  qty            int not null check (qty between 1 and 50),
  unit_price_pln numeric(10,2) not null,
  created_at     timestamptz not null default now(),
  primary key (order_id, stock_item_id)
);

create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  home_id       uuid not null references public.funeral_homes (id) on delete cascade,
  stock_item_id uuid not null references public.stock_items (id) on delete cascade,
  order_id      uuid references public.orders (id) on delete set null,
  delta         int not null,
  qty_after     int not null,
  reason        public.stock_reason not null,
  note          text check (length(note) <= 200),
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index stock_movements_item_idx on public.stock_movements (stock_item_id, created_at desc);

alter table public.stock_items enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
revoke all on public.stock_items, public.order_items, public.stock_movements from anon, authenticated;
grant select, insert, update on public.stock_items to authenticated;
grant select, insert, delete on public.order_items to authenticated;
grant select on public.stock_movements to authenticated;
-- Cena przy zleceniu to kopia z chwili przypisania; zakład nie podmienia jej później.
revoke update on public.stock_items from authenticated;
grant update (name, material, supplier, sku, price_pln, qty, min_qty, active) on public.stock_items to authenticated;

create policy stock_items_read on public.stock_items for select to authenticated
  using (home_id in (select my_homes()));
create policy stock_items_insert on public.stock_items for insert to authenticated
  with check (home_id in (select my_admin_homes()));
create policy stock_items_update on public.stock_items for update to authenticated
  using (home_id in (select my_admin_homes())) with check (home_id in (select my_admin_homes()));

create policy order_items_read on public.order_items for select to authenticated
  using (home_id in (select my_homes()));
create policy order_items_insert on public.order_items for insert to authenticated
  with check (home_id in (select my_admin_homes())
              and exists (select 1 from orders o where o.id = order_id and o.home_id = order_items.home_id)
              and exists (select 1 from stock_items s where s.id = stock_item_id and s.home_id = order_items.home_id));
create policy order_items_delete on public.order_items for delete to authenticated
  using (home_id in (select my_admin_homes()));

create policy stock_movements_read on public.stock_movements for select to authenticated
  using (home_id in (select my_homes()));

-- Ruchy magazynowe ----------------------------------------------------------------

-- Zmiana stanu w produkcie: dostawa albo korekta (powód z ustawienia ostoja.stock_reason, domyślnie korekta).
create or replace function public.stock_items_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_reason stock_reason;
  v_setting text := current_setting('ostoja.stock_reason', true);
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.qty is not distinct from old.qty then
    return new;
  end if;
  if tg_op = 'INSERT' and new.qty = 0 then
    return new;
  end if;
  if v_setting in ('zlecenie', 'zwrot') then
    return new; -- ruch zapisuje trigger order_items
  end if;
  v_reason := case when v_setting = 'dostawa' then 'dostawa'::stock_reason else 'korekta'::stock_reason end;
  insert into stock_movements (home_id, stock_item_id, delta, qty_after, reason, note, created_by)
  values (new.home_id, new.id, new.qty - coalesce(old.qty, 0), new.qty, v_reason,
          nullif(current_setting('ostoja.stock_note', true), ''), auth.uid());
  return new;
end $$;
revoke all on function public.stock_items_log() from public;
create trigger stock_items_log_upd before update on public.stock_items
  for each row execute function public.stock_items_log();

create or replace function public.stock_items_log_ins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.qty > 0 then
    insert into stock_movements (home_id, stock_item_id, delta, qty_after, reason, note, created_by)
    values (new.home_id, new.id, new.qty, new.qty, 'dostawa', 'Stan początkowy', auth.uid());
  end if;
  return null;
end $$;
revoke all on function public.stock_items_log_ins() from public;
create trigger stock_items_log_ins after insert on public.stock_items
  for each row execute function public.stock_items_log_ins();

-- Przypisanie do zlecenia zdejmuje ze stanu (cena z produktu), usunięcie oddaje na stan.
create or replace function public.order_items_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_item stock_items%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into v_item from stock_items where id = new.stock_item_id for update;
    if not v_item.active then
      raise exception 'Ten produkt jest wycofany z oferty.' using errcode = 'P0001';
    end if;
    if v_item.qty < new.qty then
      raise exception 'Brak na stanie. Przyjmij dostawę albo popraw stan w magazynie.' using errcode = 'P0001';
    end if;
    new.unit_price_pln := v_item.price_pln;
    perform set_config('ostoja.stock_reason', 'zlecenie', true);
    update stock_items set qty = qty - new.qty where id = new.stock_item_id;
    perform set_config('ostoja.stock_reason', '', true);
    insert into stock_movements (home_id, stock_item_id, order_id, delta, qty_after, reason, created_by)
    values (new.home_id, new.stock_item_id, new.order_id, -new.qty, v_item.qty - new.qty, 'zlecenie', auth.uid());
    return new;
  else
    perform set_config('ostoja.stock_reason', 'zwrot', true);
    update stock_items set qty = qty + old.qty where id = old.stock_item_id returning * into v_item;
    perform set_config('ostoja.stock_reason', '', true);
    if v_item.id is not null then
      insert into stock_movements (home_id, stock_item_id, order_id, delta, qty_after, reason, created_by)
      values (old.home_id, old.stock_item_id, old.order_id, old.qty, v_item.qty, 'zwrot', auth.uid());
    end if;
    return old;
  end if;
end $$;
revoke all on function public.order_items_stock() from public;
create trigger order_items_stock_ins before insert on public.order_items
  for each row execute function public.order_items_stock();
create trigger order_items_stock_del before delete on public.order_items
  for each row execute function public.order_items_stock();

-- ===================== 20261101000300_invoicing.sql =====================
-- Faktury przez program, którego zakład już używa (pierwszy: Fakturownia; KSeF obsługuje program zakładu).
-- 1) Adres osoby, która płaci (faktura i wniosek o zasiłek) – w zleceniu, uzupełnia zakład albo rodzina z linku.
-- 2) Połączenie z programem do faktur: klucz API zaszyfrowany przez aplikację (AES-256-GCM, klucz w zmiennej
--    środowiskowej INTEGRATIONS_KEY). Kolumny z sekretem nie da się odczytać rolą authenticated – czyta ją tylko serwer.
-- 3) Faktura do zlecenia: po oznaczeniu umowy jako podpisanej trafia do kolejki (status do_wystawienia), serwer wystawia
--    ją w programie zakładu i zapisuje numer, a po wysyłce do KSeF – numer KSeF. Zakład może też wpisać fakturę ręcznie.
-- REGON i rachunek zakładu – do wniosku o zasiłek (wypłata na rachunek zakładu) i do faktury.

alter table public.orders
  add column principal_street    text check (length(principal_street) <= 120),
  add column principal_post_code text check (principal_post_code ~ '^[0-9]{2}-[0-9]{3}$'),
  add column principal_city      text check (length(principal_city) <= 80);
grant update (principal_street, principal_post_code, principal_city) on public.orders to authenticated;

alter table public.funeral_homes
  add column regon        text check (regon ~ '^([0-9]{9}|[0-9]{14})$'),
  add column bank_account text check (bank_account ~ '^[0-9]{26}$');
grant update (regon, bank_account) on public.funeral_homes to authenticated;

create type public.invoicing_provider as enum ('fakturownia', 'infakt', 'wfirma', 'ifirma');
create type public.invoice_status as enum ('do_wystawienia', 'wystawiona', 'blad', 'reczna');

create table public.invoicing_connections (
  home_id        uuid primary key references public.funeral_homes (id) on delete cascade,
  provider       public.invoicing_provider not null,
  account        text not null check (account ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  secret_enc     text not null,
  secret_hint    text not null check (length(secret_hint) <= 8),
  vat_rate       text not null default '8' check (vat_rate in ('8', '23', 'zw')),
  auto_issue     boolean not null default true,
  ksef_b2c       boolean not null default false,
  updated_by     uuid,
  updated_at     timestamptz not null default now()
);
alter table public.invoicing_connections enable row level security;
revoke all on public.invoicing_connections from anon, authenticated;
grant insert, update, delete on public.invoicing_connections to authenticated;
grant select (home_id, provider, account, secret_hint, vat_rate, auto_issue, ksef_b2c, updated_at)
  on public.invoicing_connections to authenticated;
-- Połączenie ustawia i widzi tylko właściciel zakładu.
create policy invoicing_owner_read on public.invoicing_connections for select to authenticated
  using (home_id in (select my_owner_homes()));
create policy invoicing_owner_insert on public.invoicing_connections for insert to authenticated
  with check (home_id in (select my_owner_homes()));
create policy invoicing_owner_update on public.invoicing_connections for update to authenticated
  using (home_id in (select my_owner_homes())) with check (home_id in (select my_owner_homes()));
create policy invoicing_owner_delete on public.invoicing_connections for delete to authenticated
  using (home_id in (select my_owner_homes()));

create table public.invoices (
  order_id      uuid primary key references public.orders (id) on delete cascade,
  home_id       uuid not null references public.funeral_homes (id) on delete cascade,
  provider      public.invoicing_provider,
  status        public.invoice_status not null default 'do_wystawienia',
  external_id   text check (length(external_id) <= 80),
  number        text check (length(number) <= 60),
  issued_on     date,
  gross_pln     numeric(10,2) check (gross_pln >= 0),
  ksef_number   text check (ksef_number ~ '^[0-9]{10}-[0-9]{8}-[0-9A-Z]{6,40}$'),
  ksef_status   text check (ksef_status in ('processing', 'ok', 'send_error', 'offline', 'offline_error')),
  view_url      text check (view_url ~ '^https://'),
  attempts      int not null default 0,
  last_error    text check (length(last_error) <= 300),
  next_try_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index invoices_queue_idx on public.invoices (next_try_at) where status = 'do_wystawienia';
alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
grant select on public.invoices to authenticated;
create policy invoices_read on public.invoices for select to authenticated
  using (home_id in (select my_homes()));

-- Kolejka: umowa podpisana + połączenie z autowystawianiem → faktura do wystawienia.
create or replace function public.orders_queue_invoice() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_provider invoicing_provider;
begin
  if old.contract_signed_at is null and new.contract_signed_at is not null then
    select provider into v_provider from invoicing_connections where home_id = new.home_id and auto_issue;
    if found then
      insert into invoices (order_id, home_id, provider, gross_pln)
      values (new.id, new.home_id, v_provider, new.total_pln)
      on conflict (order_id) do nothing;
    end if;
  end if;
  return null;
end $$;
revoke all on function public.orders_queue_invoice() from public;
create trigger orders_queue_invoice after update of contract_signed_at on public.orders
  for each row execute function public.orders_queue_invoice();

-- Zakład (właściciel, biuro): wystaw teraz / ponów po błędzie.
create or replace function public.request_invoice(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_provider invoicing_provider;
begin
  select * into v_order from orders where id = p_order and home_id in (select my_admin_homes());
  if not found then
    raise exception 'Fakturę wystawia właściciel albo biuro zakładu' using errcode = '42501';
  end if;
  if v_order.contract_signed_at is null then
    raise exception 'Fakturę wystawisz po podpisaniu umowy.' using errcode = 'P0001';
  end if;
  select provider into v_provider from invoicing_connections where home_id = v_order.home_id;
  if not found then
    raise exception 'Najpierw połącz program do faktur w profilu zakładu.' using errcode = 'P0001';
  end if;
  insert into invoices (order_id, home_id, provider, gross_pln)
  values (v_order.id, v_order.home_id, v_provider, v_order.total_pln)
  on conflict (order_id) do update
    set status = 'do_wystawienia', provider = excluded.provider, gross_pln = excluded.gross_pln,
        next_try_at = now(), last_error = null, updated_at = now()
    where invoices.status = 'blad';
  if not exists (select 1 from invoices where order_id = v_order.id and status = 'do_wystawienia') then
    raise exception 'Faktura do tego zlecenia jest już wystawiona.' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.request_invoice(uuid) from public;
grant execute on function public.request_invoice(uuid) to authenticated;

-- Zakład bez połączenia (albo faktura z innego programu): wpisuje dane faktury ręcznie – trafią do wniosku Z-12.
create or replace function public.record_manual_invoice(p_order uuid, p_number text, p_issued date, p_gross numeric, p_ksef text)
returns void language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order and home_id in (select my_admin_homes());
  if not found then
    raise exception 'Fakturę wystawia właściciel albo biuro zakładu' using errcode = '42501';
  end if;
  if exists (select 1 from invoices where order_id = p_order and status in ('wystawiona', 'do_wystawienia')) then
    raise exception 'Faktura do tego zlecenia jest już wystawiona.' using errcode = 'P0001';
  end if;
  insert into invoices (order_id, home_id, provider, status, number, issued_on, gross_pln, ksef_number, ksef_status)
  values (p_order, v_order.home_id, null, 'reczna', trim(p_number), p_issued, p_gross,
          nullif(upper(trim(coalesce(p_ksef, ''))), ''), case when nullif(trim(coalesce(p_ksef, '')), '') is not null then 'ok' end)
  on conflict (order_id) do update
    set provider = null, status = 'reczna', number = excluded.number, issued_on = excluded.issued_on,
        gross_pln = excluded.gross_pln, ksef_number = excluded.ksef_number, ksef_status = excluded.ksef_status,
        last_error = null, updated_at = now();
end $$;
revoke all on function public.record_manual_invoice(uuid, text, date, numeric, text) from public;
grant execute on function public.record_manual_invoice(uuid, text, date, numeric, text) to authenticated;

-- Serwer: pobranie faktur do wystawienia (z blokadą, żeby dwa wywołania nie wystawiły dwóch faktur).
create or replace function public.claim_invoices(p_limit int default 10)
returns setof public.invoices language sql security definer set search_path = public as $$
  update invoices set attempts = attempts + 1, next_try_at = now() + interval '10 minutes', updated_at = now()
  where order_id in (select order_id from invoices
                     where status = 'do_wystawienia' and next_try_at <= now()
                     order by next_try_at limit p_limit for update skip locked)
  returning *
$$;
revoke all on function public.claim_invoices(int) from public;
grant execute on function public.claim_invoices(int) to service_role;

-- Rodzina uzupełnia też adres (faktura, wniosek o zasiłek). Definicja jak w 20261016001200_obituaries + adres.
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
    'principal_street', o.principal_street, 'principal_post_code', o.principal_post_code, 'principal_city', o.principal_city,
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

create or replace function public.family_update_order(p_token text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_allowed text[] := array['deceased_first_name', 'deceased_last_name', 'born_on', 'died_at',
                            'principal_email', 'principal_street', 'principal_post_code', 'principal_city',
                            'zus_bank_account', 'selected_items', 'family_consents'];
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
    principal_street    = case when p_patch ? 'principal_street' then nullif(trim(p_patch->>'principal_street'), '') else principal_street end,
    principal_post_code = case when p_patch ? 'principal_post_code' then nullif(trim(p_patch->>'principal_post_code'), '') else principal_post_code end,
    principal_city      = case when p_patch ? 'principal_city' then nullif(trim(p_patch->>'principal_city'), '') else principal_city end,
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

-- ===================== 20261101000400_zus_claims.sql =====================
-- Wniosek o zasiłek pogrzebowy (ZUS Z-12) z danych zlecenia. Treść wg § 4 ust. 2a rozporządzenia w sprawie postępowania
-- o świadczenia emerytalno-rentowe (zmiana z 29.12.2025, Dz.U. 2025 poz. 1888, od 1.01.2026):
-- dane zmarłego (imię, nazwisko, PESEL albo dokument, data i miejsce zgonu), oświadczenia (pokrewieństwo, pokrycie
-- kosztów, brak zasiłku z innego tytułu, inny organ rentowy zmarłego), przy wniosku przez zakład pogrzebowy: nazwa,
-- NIP, REGON, adres i upoważnienie do wypłaty na rachunek zakładu (w całości albo w części).
-- Uzupełnia właściciel albo biuro; ekipa widzi do druku. PESEL tylko w tej tabeli – nigdy w logach.
-- Nie ma tu pola na przyczynę zgonu i nie będzie.

create table public.zus_claims (
  order_id            uuid primary key references public.orders (id) on delete cascade,
  home_id             uuid not null references public.funeral_homes (id) on delete cascade,
  applicant_pesel     text check (applicant_pesel ~ '^[0-9]{11}$'),
  applicant_id_doc    text check (length(applicant_id_doc) <= 30),
  applicant_relation  text check (length(applicant_relation) <= 60),
  deceased_pesel      text check (deceased_pesel ~ '^[0-9]{11}$'),
  deceased_id_doc     text check (length(deceased_id_doc) <= 30),
  death_place         text check (length(death_place) <= 120),
  other_pension_body  text check (length(other_pension_body) <= 120),
  costs_covered       text not null default 'calosc' check (costs_covered in ('calosc', 'czesc')),
  no_other_benefit    boolean not null default false,
  payout_to_home      text not null default 'brak' check (payout_to_home in ('brak', 'calosc', 'czesc')),
  payout_home_pln     numeric(10,2) check (payout_home_pln between 0 and 100000),
  updated_at          timestamptz not null default now(),
  check (payout_to_home <> 'czesc' or payout_home_pln is not null)
);
alter table public.zus_claims enable row level security;
revoke all on public.zus_claims from anon, authenticated;
grant select, insert, update on public.zus_claims to authenticated;
create policy zus_claims_read on public.zus_claims for select to authenticated
  using (home_id in (select my_homes()));
create policy zus_claims_insert on public.zus_claims for insert to authenticated
  with check (home_id in (select my_admin_homes())
              and exists (select 1 from orders o where o.id = order_id and o.home_id = zus_claims.home_id));
create policy zus_claims_update on public.zus_claims for update to authenticated
  using (home_id in (select my_admin_homes()))
  with check (home_id in (select my_admin_homes())
              and exists (select 1 from orders o where o.id = order_id and o.home_id = zus_claims.home_id));

-- Wypłata na rachunek zakładu tylko za zgodą rodziny z linku (family_consents.wniosek_przez_zaklad).
create or replace function public.zus_claims_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.payout_to_home <> 'brak' and not exists (
    select 1 from orders o where o.id = new.order_id and coalesce((o.family_consents->>'wniosek_przez_zaklad')::boolean, false)
  ) then
    raise exception 'Wypłata na rachunek zakładu wymaga zgody rodziny z linku.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.zus_claims_guard() from public;
create trigger zus_claims_guard before insert or update on public.zus_claims
  for each row execute function public.zus_claims_guard();

-- Wniosek RODO: dane z wniosku o zasiłek usuwa się razem ze zleceniem (on delete cascade).

-- ===================== 20261101000500_grave_care.sql =====================
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

-- ===================== 20261101000600_cemeteries_reference.sql =====================
-- Cmentarze z internetową wyszukiwarką grobów (stan: 1.11.2026). Źródła: tvn24.pl (30.10.2025),
-- gisplay.pl (28.10.2026), se.pl (Trójmiasto), wroclaw.pl. Tylko cmentarze, których nazwę i wyszukiwarkę potwierdzają
-- źródła; współrzędne i kolejne cmentarze dopisujemy po sprawdzeniu. Pełna lista: docs/cmentarze-wyszukiwarki.md.
-- locator = 'grobonet' (wyszukiwarka Grobonet z mapą cmentarza) albo 'miejska' (wyszukiwarka zarządcy z kwaterą/rzędem/numerem).

insert into public.cemeteries (name, city, kind, locator, locator_url, phrase, source) values
  -- Gdańsk (Grobonet, Gdańskie Cmentarze Komunalne)
  ('Cmentarz Łostowicki', 'Gdańsk', 'komunalny', 'grobonet', 'https://www.cmentarze-gdanskie.pl/chapter_77139.asp', 'na Cmentarzu Łostowickim w Gdańsku', 'grobonet'),
  ('Cmentarz Oliwski', 'Gdańsk', 'komunalny', 'grobonet', 'https://www.cmentarze-gdanskie.pl/chapter_77139.asp', 'na Cmentarzu Oliwskim w Gdańsku', 'grobonet'),
  ('Cmentarz Srebrzysko', 'Gdańsk', 'komunalny', 'grobonet', 'https://www.cmentarze-gdanskie.pl/chapter_77139.asp', 'na Cmentarzu Srebrzysko w Gdańsku', 'grobonet'),
  ('Cmentarz Garnizonowy', 'Gdańsk', 'komunalny', 'grobonet', 'https://www.cmentarze-gdanskie.pl/chapter_77139.asp', 'na Cmentarzu Garnizonowym w Gdańsku', 'grobonet'),
  ('Cmentarz Sobieszewski', 'Gdańsk', 'komunalny', 'grobonet', 'https://www.cmentarze-gdanskie.pl/chapter_77139.asp', 'na Cmentarzu Sobieszewskim w Gdańsku', 'grobonet'),
  -- Gdynia (Grobonet)
  ('Cmentarz Komunalny Witomino', 'Gdynia', 'komunalny', 'grobonet', 'https://gdynia.grobonet.com/grobonet/start.php', 'na Cmentarzu Komunalnym Witomino w Gdyni', 'grobonet'),
  ('Cmentarz Komunalny Kosakowo', 'Gdynia', 'komunalny', 'grobonet', 'https://gdynia.grobonet.com/grobonet/start.php', 'na Cmentarzu Komunalnym w Kosakowie', 'grobonet'),
  ('Cmentarz Komunalny Mały Kack', 'Gdynia', 'komunalny', 'grobonet', 'https://gdynia.grobonet.com/grobonet/start.php', 'na Cmentarzu Komunalnym Mały Kack w Gdyni', 'grobonet'),
  -- Białystok (Grobonet)
  ('Cmentarz Miejski w Białymstoku', 'Białystok', 'komunalny', 'grobonet', 'https://bialystok.grobonet.com/grobonet/start.php', 'na Cmentarzu Miejskim w Białymstoku', 'grobonet'),
  -- Warszawa (Zarząd Cmentarzy Komunalnych – wyszukiwarka z mapą)
  ('Cmentarz Komunalny Północny', 'Warszawa', 'komunalny', 'miejska', 'https://www.cmentarzekomunalne.com.pl/mapa/', 'na Cmentarzu Komunalnym Północnym w Warszawie', 'reczny'),
  ('Cmentarz Komunalny Południowy', 'Warszawa', 'komunalny', 'miejska', 'https://www.cmentarzekomunalne.com.pl/mapa/', 'na Cmentarzu Komunalnym Południowym w Antoninowie', 'reczny'),
  ('Cmentarz Wojskowy na Powązkach', 'Warszawa', 'wojskowy', 'miejska', 'https://www.cmentarzekomunalne.com.pl/mapa/', 'na Cmentarzu Wojskowym na Powązkach w Warszawie', 'reczny'),
  -- Kraków (Zarząd Cmentarzy Komunalnych – lokalizator)
  ('Cmentarz Rakowicki', 'Kraków', 'komunalny', 'miejska', 'https://zck-krakow.pl/18/locator', 'na Cmentarzu Rakowickim w Krakowie', 'reczny'),
  ('Cmentarz Prądnik Czerwony (Batowice)', 'Kraków', 'komunalny', 'miejska', 'https://zck-krakow.pl/18/locator', 'na Cmentarzu Prądnik Czerwony w Krakowie', 'reczny'),
  ('Cmentarz Grębałów', 'Kraków', 'komunalny', 'miejska', 'https://zck-krakow.pl/18/locator', 'na Cmentarzu Grębałów w Krakowie', 'reczny'),
  ('Cmentarz Podgórski', 'Kraków', 'komunalny', 'miejska', 'https://zck-krakow.pl/18/locator', 'na Cmentarzu Podgórskim w Krakowie', 'reczny'),
  -- Wrocław (Zarząd Cmentarzy Komunalnych – katalog z mapą)
  ('Cmentarz Osobowicki', 'Wrocław', 'komunalny', 'miejska', 'https://groby.cui.wroclaw.pl', 'na Cmentarzu Osobowickim we Wrocławiu', 'reczny'),
  ('Cmentarz Grabiszyński', 'Wrocław', 'komunalny', 'miejska', 'https://groby.cui.wroclaw.pl', 'na Cmentarzu Grabiszyńskim we Wrocławiu', 'reczny'),
  -- Poznań (wyszukiwarka grobów miasta)
  ('Cmentarz Junikowo', 'Poznań', 'komunalny', 'miejska', 'https://www.poznan.pl/mim/necropolis/', 'na Cmentarzu Junikowo w Poznaniu', 'reczny'),
  ('Cmentarz Miłostowo', 'Poznań', 'komunalny', 'miejska', 'https://www.poznan.pl/mim/necropolis/', 'na Cmentarzu Miłostowo w Poznaniu', 'reczny'),
  -- Łódź (Cmentarze Komunalne w Łodzi – wyszukiwarka)
  ('Cmentarz Komunalny Doły', 'Łódź', 'komunalny', 'miejska', 'http://cmentarzekomunalne.lodz.systkom.pl/szukaj.html', 'na Cmentarzu Komunalnym Doły w Łodzi', 'reczny'),
  ('Cmentarz Komunalny Zarzew', 'Łódź', 'komunalny', 'miejska', 'http://cmentarzekomunalne.lodz.systkom.pl/szukaj.html', 'na Cmentarzu Komunalnym Zarzew w Łodzi', 'reczny'),
  -- Szczecin (Zakład Usług Komunalnych)
  ('Cmentarz Centralny w Szczecinie', 'Szczecin', 'komunalny', 'miejska', 'https://www.cmentarze.szczecin.pl/chapter_11975.asp', 'na Cmentarzu Centralnym w Szczecinie', 'reczny');

-- ===================== Harmonogram: faktury co 5 minut =====================
-- Ten sam sekret co powiadomienia (Vault: ostoja_cron_secret). Zanim nowa wersja aplikacji będzie na ostoja.org,
-- wywołanie dostaje 404 – to nic nie psuje.
select cron.schedule(
  'ostoja-faktury',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://ostoja.org/api/faktury',
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ostoja_cron_secret')
    )
  );
  $$
);

commit;

-- Sprawdzenie (uruchom osobno po wdrożeniu) – każdy wiersz powinien mieć „tak”:
-- select 'oceny' as co, to_regclass('public.home_reviews') is not null as tak
-- union all select 'magazyn', to_regclass('public.stock_items') is not null
-- union all select 'faktury', to_regclass('public.invoices') is not null
-- union all select 'wniosek Z-12', to_regclass('public.zus_claims') is not null
-- union all select 'opieka nad grobem', to_regclass('public.grave_orders') is not null
-- union all select 'cmentarze (23)', (select count(*) from public.cemeteries) >= 23
-- union all select 'harmonogram faktur', exists (select 1 from cron.job where jobname = 'ostoja-faktury');
