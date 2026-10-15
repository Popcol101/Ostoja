-- Ostoja: schemat bazy (tabele, typy, indeksy).
-- Zasady: czas w UTC (timestamptz), kwoty w PLN (numeric), brak pola na przyczynę zgonu.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create type burial_type    as enum ('tradycyjny', 'kremacja', 'nie_wiem');
create type ceremony_type  as enum ('religijna', 'swiecka', 'bez');
create type place_of_death as enum ('szpital', 'dom', 'dps');
create type inquiry_status as enum ('otwarte', 'przyjete', 'do_opiekuna', 'zamkniete');
create type offer_status   as enum ('nowe', 'przyjete', 'odrzucone', 'wygasle', 'zamkniete');
create type order_stage    as enum ('przyjete', 'umowa', 'odbior', 'ceremonia', 'rozliczenie', 'zamkniete');
create type event_kind     as enum ('odbior', 'kremacja', 'ceremonia', 'pochowek', 'spotkanie', 'inne');
create type event_status   as enum ('wstepny', 'potwierdzony', 'odwolany');
create type member_role    as enum ('wlasciciel', 'biuro', 'ekipa');
create type resource_kind  as enum ('karawan', 'sala', 'chlodnia');

-- Słowniki publiczne -------------------------------------------------------

create table cities (
  slug text primary key,
  name text not null,
  lat  double precision not null,
  lng  double precision not null
);

-- Standard cennika Ostoi: te same pozycje w każdym zakładzie.
create table price_catalog (
  item_key       text primary key,
  label          text not null,
  for_burial     text not null check (for_burial in ('wszystkie', 'tradycyjny', 'kremacja')),
  needs_ceremony boolean not null default false,
  sort_order     int not null
);

-- Zakłady i ich ludzie -----------------------------------------------------

create table funeral_homes (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  nip               text not null unique,
  city_slug         text not null references cities,
  address           text not null,
  phone             text not null,
  email             text not null,
  description       text,
  lat               double precision not null,
  lng               double precision not null,
  service_radius_km int not null default 25 check (service_radius_km between 1 and 200),
  has_farewell_hall boolean not null default false,
  accepting_today   boolean not null default true,
  rating            numeric(2,1) check (rating between 1 and 5),
  reviews_count     int not null default 0,
  verified_at       timestamptz,
  created_at        timestamptz not null default now()
);

create table memberships (
  user_id      uuid not null references auth.users on delete cascade,
  home_id      uuid not null references funeral_homes on delete cascade,
  role         member_role not null,
  display_name text not null,
  primary key (user_id, home_id)
);
create index memberships_home_idx on memberships (home_id);

create table price_items (
  home_id   uuid not null references funeral_homes on delete cascade,
  item_key  text not null references price_catalog,
  price_pln numeric(10,2) not null check (price_pln >= 0),
  primary key (home_id, item_key)
);

-- Zapytania rodzin ---------------------------------------------------------

create table inquiries (
  id                 uuid primary key default gen_random_uuid(),
  city_slug          text not null references cities,
  burial             burial_type not null,
  ceremony           ceremony_type not null,
  place_of_death     place_of_death not null,
  budget             text check (budget in ('zasilek', 'srednio', 'wiecej', 'nie_wiem')),
  guests_estimate    int check (guests_estimate between 0 and 2000),
  contact_name       text not null check (length(contact_name) between 2 and 120),
  contact_phone      text not null check (contact_phone ~ '^\+?[0-9 ]{9,16}$'),
  preferred_home_id  uuid references funeral_homes,
  status             inquiry_status not null default 'otwarte',
  dispatch_round     int not null default 1,
  phone_verified_at  timestamptz,
  created_at         timestamptz not null default now()
);
create index inquiries_open_idx on inquiries (status) where status = 'otwarte';

create table offers (
  id           uuid primary key default gen_random_uuid(),
  inquiry_id   uuid not null references inquiries on delete cascade,
  home_id      uuid not null references funeral_homes on delete cascade,
  status       offer_status not null default 'nowe',
  quote_pln    numeric(10,2) not null,
  distance_km  numeric(6,1) not null,
  round        int not null default 1,
  sent_at      timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '15 minutes',
  responded_at timestamptz,
  unique (inquiry_id, home_id)
);
create index offers_home_status_idx on offers (home_id, status);
create index offers_expiry_idx on offers (expires_at) where status = 'nowe';
-- Najwyżej jedno przyjęcie na zapytanie, nawet przy dwóch kliknięciach naraz.
create unique index offers_one_accept_idx on offers (inquiry_id) where status = 'przyjete';

-- Zlecenia ----------------------------------------------------------------

create table orders (
  id                  uuid primary key default gen_random_uuid(),
  home_id             uuid not null references funeral_homes on delete cascade,
  offer_id            uuid unique references offers,          -- null = zlecenie spoza Ostoi
  stage               order_stage not null default 'przyjete',
  burial              burial_type not null,
  ceremony            ceremony_type not null,
  deceased_first_name text,
  deceased_last_name  text,
  born_on             date,
  died_at             timestamptz,
  principal_name      text not null,
  principal_phone     text not null,
  principal_email     text,
  zus_bank_account    text check (zus_bank_account is null or zus_bank_account ~ '^[0-9 ]{26,32}$'),
  selected_items      text[] not null default '{}',
  total_pln           numeric(10,2),
  family_consents     jsonb not null default '{}'::jsonb,
  family_updated_at   timestamptz,
  notes               text,
  contract_signed_at  timestamptz,                             -- moment naliczenia opłaty Ostoi
  memorial_slug       text unique,
  memorial_published  boolean not null default false,
  memorial_note       text check (length(memorial_note) <= 600),
  family_token        text not null unique default encode(gen_random_bytes(24), 'hex'),
  family_token_until  timestamptz not null default now() + interval '60 days',
  created_at          timestamptz not null default now()
);
create index orders_home_idx on orders (home_id, created_at desc);

create table order_tasks (
  id        uuid primary key default gen_random_uuid(),
  order_id  uuid not null references orders on delete cascade,
  home_id   uuid not null references funeral_homes on delete cascade,
  title     text not null,
  done      boolean not null default false,
  assignee  uuid references auth.users,
  due_at    timestamptz,
  sort_order int not null default 0
);
create index order_tasks_order_idx on order_tasks (order_id);

-- Kalendarz ---------------------------------------------------------------

create table resources (
  id      uuid primary key default gen_random_uuid(),
  home_id uuid not null references funeral_homes on delete cascade,
  kind    resource_kind not null,
  name    text not null
);

create table events (
  id       uuid primary key default gen_random_uuid(),
  home_id  uuid not null references funeral_homes on delete cascade,
  order_id uuid references orders on delete cascade,
  kind     event_kind not null,
  title    text not null,
  status   event_status not null default 'wstepny',
  during   tstzrange not null check (not isempty(during) and lower(during) is not null and upper(during) is not null),
  place    text,
  assignee uuid references auth.users,
  notes    text
);
create index events_home_during_idx on events using gist (home_id, during);
create index events_order_idx on events (order_id);

-- Rezerwacja zasobu: baza nie pozwoli zająć karawanu ani sali dwa razy naraz.
create table bookings (
  event_id    uuid not null references events on delete cascade,
  resource_id uuid not null references resources on delete cascade,
  home_id     uuid not null references funeral_homes on delete cascade,
  during      tstzrange not null,
  primary key (event_id, resource_id),
  constraint bookings_no_overlap exclude using gist (resource_id with =, during with &&)
);

create table duty_shifts (
  id      uuid primary key default gen_random_uuid(),
  home_id uuid not null references funeral_homes on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  during  tstzrange not null,
  constraint duty_no_overlap exclude using gist (home_id with =, during with &&)
);
