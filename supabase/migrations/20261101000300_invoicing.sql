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
