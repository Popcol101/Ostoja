-- Powiadomienia: push o nowym zapytaniu, SMS z linkiem dla rodziny, izolacja zakładów, kolejka wysyłki.
begin;

-- Nowe zapytanie od rodziny tworzy push do wybranego zakładu (Cisza).
create temp table t_inq as select create_inquiry(jsonb_build_object(
  'city_slug', 'lodz', 'burial', 'kremacja', 'ceremony', 'religijna', 'place_of_death', 'szpital',
  'contact_name', 'Test Testowy', 'contact_phone', '+48 600 100 200',
  'preferred_home_id', '00000000-0000-4000-a000-000000000001')) as id;
reset role;

do $$ begin
  assert (select count(*) from notifications n join offers o on o.id = n.offer_id
          where o.inquiry_id = (select id from t_inq) and n.kind = 'nowe_zapytanie' and n.channel = 'push'
            and n.home_id = '00000000-0000-4000-a000-000000000001') = 1,
    'brak powiadomienia push o nowym zapytaniu';
end $$;

-- Anna (Cisza): zleca SMS dla rodziny Mazur, widzi historię; nie widzi cudzych subskrypcji.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare v uuid;
begin
  v := queue_family_sms('00000000-0000-4000-d000-000000000005');
  assert v is not null, 'SMS nie trafił do kolejki';
  assert exists (select 1 from notifications where id = v and status = 'oczekuje'), 'zakład nie widzi swojego SMS-a';

  perform queue_family_sms('00000000-0000-4000-d000-000000000005');
  perform queue_family_sms('00000000-0000-4000-d000-000000000005');
  begin
    perform queue_family_sms('00000000-0000-4000-d000-000000000005');
    raise exception 'FAIL: czwarty SMS w ciągu doby przeszedł';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  insert into push_subscriptions (user_id, home_id, endpoint, p256dh, auth)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-a000-000000000001',
          'https://push.example/anna', repeat('a', 87), repeat('b', 22));
end $$;

-- Nie da się zapisać subskrypcji w imieniu kogoś innego ani w cudzym zakładzie.
do $$ begin
  insert into push_subscriptions (user_id, home_id, endpoint, p256dh, auth)
  values ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-a000-000000000002',
          'https://push.example/obcy', repeat('a', 87), repeat('b', 22));
  raise exception 'FAIL: zapisano cudzą subskrypcję';
exception when insufficient_privilege then null;
end $$;

-- Zakład nie dodaje powiadomień bezpośrednio i nie uruchamia wysyłki.
do $$ begin
  insert into notifications (home_id, kind, channel, order_id)
  values ('00000000-0000-4000-a000-000000000001', 'link_dla_rodziny', 'sms', '00000000-0000-4000-d000-000000000005');
  raise exception 'FAIL: bezpośredni zapis do notifications';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform * from claim_notifications(10);
  raise exception 'FAIL: zakład uruchomił kolejkę wysyłki';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Piotr (Pod Lipami) nie widzi powiadomień Ciszy i nie zleci SMS-a do jej rodziny.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from notifications where home_id = '00000000-0000-4000-a000-000000000001') = 0, 'widać cudze powiadomienia';
  assert (select count(*) from push_subscriptions) = 0, 'widać cudze subskrypcje';
  begin
    perform queue_family_sms('00000000-0000-4000-d000-000000000005');
    raise exception 'FAIL: SMS do rodziny innego zakładu';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Kolejka wysyłki (rola serwera): rezerwacja, brak podwójnej wysyłki, ponowienie po błędzie.
do $$
declare
  r record;
  n int;
begin
  select count(*) into n from claim_notifications(100);
  assert n >= 4, 'kolejka nie zwróciła powiadomień';
  assert (select count(*) from claim_notifications(100)) = 0, 'zarezerwowane powiadomienia wydane drugi raz';

  select * into r from notifications where kind = 'link_dla_rodziny' limit 1;
  perform complete_notification(r.id, 'blad', 'Timeout');
  assert (select status from notifications where id = r.id) = 'oczekuje', 'błąd przejściowy nie wrócił do kolejki';

  select * into r from claim_notifications(100) where kind = 'link_dla_rodziny' limit 1;
  assert r.family_phone = '+48 600 000 006' or r.family_phone is not null, 'brak telefonu do SMS-a';
  assert r.family_token like 'demo-rodzina-mazur%', 'brak tokenu linku';
  perform complete_notification(r.id, 'wyslano');
  assert (select sent_at is not null from notifications where id = r.id), 'brak czasu wysyłki';
end $$;

-- Push o zapytaniu, które ktoś już przyjął, jest pomijany.
do $$ begin
  update notifications set status = 'oczekuje', locked_until = null where kind = 'nowe_zapytanie';
  update offers set status = 'zamkniete' where inquiry_id = (select id from t_inq);
  assert skip_stale_offer_notifications() >= 1, 'nieaktualne powiadomienie nie zostało pominięte';
end $$;

rollback;
