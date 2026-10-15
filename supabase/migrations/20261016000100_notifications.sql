-- Ostoja: powiadomienia. Skrzynka nadawcza w bazie (outbox) + subskrypcje push.
-- Nowe zapytanie → push do pracowników zakładu. Link dla rodziny → SMS na telefon z zapytania.
-- Wysyłką zajmuje się serwer aplikacji (src/lib/notify.ts) połączeniem z rolą postgres,
-- przez claim_notifications() / complete_notification(). Treść SMS-a składamy w chwili wysyłki,
-- więc telefonu rodziny nie kopiujemy do kolejnej tabeli.

create type notification_channel as enum ('push', 'sms');
create type notification_status as enum ('oczekuje', 'wyslano', 'blad', 'pominieto');

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  home_id      uuid not null references public.funeral_homes (id) on delete cascade,
  endpoint     text not null unique check (endpoint ~ '^https://'),
  p256dh       text not null check (length(p256dh) between 40 and 200),
  auth         text not null check (length(auth) between 10 and 100),
  device       text check (length(device) <= 120),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_home on public.push_subscriptions (home_id);

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  home_id      uuid not null references public.funeral_homes (id) on delete cascade,
  kind         text not null check (kind in ('nowe_zapytanie', 'link_dla_rodziny')),
  channel      notification_channel not null,
  offer_id     uuid references public.offers (id) on delete cascade,
  order_id     uuid references public.orders (id) on delete cascade,
  status       notification_status not null default 'oczekuje',
  attempts     int not null default 0,
  locked_until timestamptz,
  last_error   text check (length(last_error) <= 300),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  check ((kind = 'nowe_zapytanie' and offer_id is not null) or (kind = 'link_dla_rodziny' and order_id is not null))
);
create index notifications_pending on public.notifications (created_at) where status = 'oczekuje';
create index notifications_order on public.notifications (order_id);

alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;

-- Pracownik zarządza tylko subskrypcjami swoich urządzeń w swoim zakładzie.
grant select, insert, delete on public.push_subscriptions to authenticated;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and home_id in (select my_homes()));

-- Zakład widzi historię powiadomień swoich zleceń; dodaje je tylko przez queue_family_sms().
grant select on public.notifications to authenticated;
create policy notifications_member_read on public.notifications for select to authenticated
  using (home_id in (select my_homes()));

-- Nowa oferta = push do zakładu.
create or replace function public.notify_new_offer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'nowe' then
    insert into notifications (home_id, kind, channel, offer_id)
    values (new.home_id, 'nowe_zapytanie', 'push', new.id);
  end if;
  return new;
end $$;

create trigger offers_notify after insert on public.offers
  for each row execute function public.notify_new_offer();

-- Zakład prosi o SMS z linkiem dla rodziny. Najwyżej 3 SMS-y na zlecenie na dobę (koszt, nękanie).
create or replace function public.queue_family_sms(p_order uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_id uuid;
begin
  select * into v_order from orders where id = p_order;
  if not found or v_order.home_id not in (select my_homes()) then
    raise exception 'Brak dostępu do zapytania' using errcode = '42501';
  end if;
  if v_order.principal_phone is null or v_order.family_token is null then
    raise exception 'Brak numeru telefonu rodziny w zleceniu' using errcode = 'P0001';
  end if;
  if (select count(*) from notifications
      where order_id = p_order and kind = 'link_dla_rodziny' and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Do rodziny poszły już 3 SMS-y w ciągu doby. Zadzwoń zamiast pisać.' using errcode = 'P0001';
  end if;
  insert into notifications (home_id, kind, channel, order_id, created_by)
  values (v_order.home_id, 'link_dla_rodziny', 'sms', p_order, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.queue_family_sms(uuid) from public;
grant execute on function public.queue_family_sms(uuid) to authenticated;

-- Dla serwera wysyłki: rezerwuje paczkę powiadomień (bezpieczne przy kilku równoległych wywołaniach)
-- i zwraca dane potrzebne do wysyłki. Bez imion i nazwisk – push na ekranie blokady ich nie pokazuje.
create or replace function public.claim_notifications(p_limit int default 50)
returns table (id uuid, kind text, channel notification_channel, home_id uuid, attempts int,
               home_name text, home_phone text,
               burial burial_type, ceremony ceremony_type, city_name text, distance_km numeric,
               family_phone text, family_token text)
language sql volatile security definer set search_path = public as $$
  with picked as (
    select n.id from notifications n
    where n.status = 'oczekuje' and n.attempts < 5
      and (n.locked_until is null or n.locked_until < now())
    order by n.created_at
    limit greatest(1, least(p_limit, 200))
    for update skip locked
  ), locked as (
    update notifications n set locked_until = now() + interval '2 minutes', attempts = n.attempts + 1
    from picked where n.id = picked.id
    returning n.*
  )
  select l.id, l.kind, l.channel, l.home_id, l.attempts,
         h.name, h.phone,
         i.burial, i.ceremony, c.name, o.distance_km,
         ord.principal_phone, ord.family_token
  from locked l
  join funeral_homes h on h.id = l.home_id
  left join offers o on o.id = l.offer_id
  left join inquiries i on i.id = o.inquiry_id
  left join cities c on c.slug = i.city_slug
  left join orders ord on ord.id = l.order_id
$$;
revoke all on function public.claim_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;

create or replace function public.complete_notification(p_id uuid, p_status notification_status, p_error text default null)
returns void language sql volatile security definer set search_path = public as $$
  update notifications set
    -- błąd przejściowy wraca do kolejki, dopóki jest limit prób
    status = case when p_status = 'blad' and attempts < 5 then 'oczekuje'::notification_status else p_status end,
    last_error = left(p_error, 300),
    locked_until = null,
    sent_at = case when p_status = 'wyslano' then now() else sent_at end
  where id = p_id
$$;
revoke all on function public.complete_notification(uuid, notification_status, text) from public, anon, authenticated;
grant execute on function public.complete_notification(uuid, notification_status, text) to service_role;

-- Powiadomienie o ofercie, która już nie czeka (przyjęta, wygasła), nie ma sensu wysyłać.
create or replace function public.skip_stale_offer_notifications() returns int
language sql volatile security definer set search_path = public as $$
  with s as (
    update notifications n set status = 'pominieto', last_error = 'Zapytanie już nie czeka'
    from offers o
    where n.offer_id = o.id and n.status = 'oczekuje' and o.status <> 'nowe'
    returning 1
  ) select count(*)::int from s
$$;
revoke all on function public.skip_stale_offer_notifications() from public, anon, authenticated;
grant execute on function public.skip_stale_offer_notifications() to service_role;
