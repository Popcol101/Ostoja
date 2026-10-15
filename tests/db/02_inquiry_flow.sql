-- Przepływ zapytania: utworzenie, rozesłanie, przyjęcie, wygasanie, przekazanie dalej.
begin;

-- Gość tworzy zapytanie do wybranego zakładu (Kalina) — trafia tylko tam.
create temp table t_ids (name text primary key, id uuid) on commit drop;
grant all on t_ids to anon, authenticated;
-- create_inquiry wywołuje tylko confirm_inquiry (po kodzie SMS) – w testach wołamy ją bezpośrednio jako właściciel bazy.
insert into t_ids values ('preferred', create_inquiry('{
  "city_slug":"lodz","burial":"kremacja","ceremony":"swiecka","place_of_death":"szpital",
  "budget":"zasilek","contact_name":"Ola Testowa","contact_phone":"+48 501 000 000",
  "preferred_home_id":"00000000-0000-4000-a000-000000000003"}'::jsonb));
-- Bez wyboru — 3 najbliższe zweryfikowane zakłady w promieniu działania.
insert into t_ids values ('open', create_inquiry('{
  "city_slug":"lodz","burial":"tradycyjny","ceremony":"religijna","place_of_death":"dom",
  "contact_name":"Jan Testowy","contact_phone":"+48 502 000 000"}'::jsonb));
-- Kraków — tylko zakład z Krakowa.
insert into t_ids values ('krakow', create_inquiry('{
  "city_slug":"krakow","burial":"kremacja","ceremony":"bez","place_of_death":"dps",
  "contact_name":"Ewa Testowa","contact_phone":"+48 503 000 000"}'::jsonb));
reset role;

do $$
declare p uuid := (select id from t_ids where name = 'preferred');
        o uuid := (select id from t_ids where name = 'open');
        k uuid := (select id from t_ids where name = 'krakow');
begin
  assert (select count(*) from offers where inquiry_id = p) = 1, 'wybrany zakład: 1 oferta';
  assert (select home_id from offers where inquiry_id = p) = '00000000-0000-4000-a000-000000000003', 'oferta nie trafiła do Kaliny';
  assert (select quote_pln from offers where inquiry_id = p) = 4980, 'zła wycena Kaliny';
  assert (select count(*) from offers where inquiry_id = o) = 3, 'otwarte zapytanie: 3 oferty';
  assert not exists (select 1 from offers where inquiry_id = o and home_id = '00000000-0000-4000-a000-000000000006'), 'niezweryfikowany zakład dostał zapytanie';
  assert (select count(*) from offers where inquiry_id = k) = 1, 'Kraków: 1 oferta';
  assert (select home_id from offers where inquiry_id = k) = '00000000-0000-4000-a000-000000000005', 'Kraków: zły zakład';
end $$;

-- Niepoprawny telefon jest odrzucany.
do $$ begin
  perform create_inquiry('{"city_slug":"lodz","burial":"kremacja","ceremony":"bez","place_of_death":"dom",
                           "contact_name":"X Y","contact_phone":"abc"}'::jsonb);
  raise exception 'FAIL: przyjęto niepoprawny telefon';
exception when check_violation then null;
end $$;
reset role;

-- Anna przyjmuje zapytanie z seeda; dostaje kontakt, inne zakłady tracą ofertę.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into t_ids values ('order', accept_offer((select id from offers
  where inquiry_id = '00000000-0000-4000-c000-000000000001' and home_id = '00000000-0000-4000-a000-000000000001')));
do $$
declare ord uuid := (select id from t_ids where name = 'order');
begin
  assert (select principal_phone from orders where id = ord) = '+48 500 100 200', 'brak telefonu rodziny po przyjęciu';
  assert (select total_pln from orders where id = ord) = 5790, 'zła suma zlecenia';
  assert (select count(*) from order_tasks where order_id = ord) = 5, 'brak zadań startowych';
end $$;
reset role;

do $$ begin
  assert (select count(*) from offers where inquiry_id = '00000000-0000-4000-c000-000000000001' and status = 'zamkniete') = 2,
    'pozostałe oferty powinny być zamknięte';
  assert (select status from inquiries where id = '00000000-0000-4000-c000-000000000001') = 'przyjete', 'zapytanie nie jest przyjęte';
end $$;

-- Piotr próbuje przyjąć to samo zapytanie — bez skutku.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  perform accept_offer((select id from offers where inquiry_id = '00000000-0000-4000-c000-000000000001'
                        and home_id = '00000000-0000-4000-a000-000000000002'));
  raise exception 'FAIL: drugi zakład przyjął to samo zapytanie';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
-- ...ani cudzej oferty.
do $$ begin
  perform accept_offer((select id from offers where inquiry_id = (select id from t_ids where name = 'preferred')));
  raise exception 'FAIL: przyjęto cudzą ofertę';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Wygasanie: po 15 minutach zapytanie idzie do kolejnych zakładów, potem do opiekuna.
update offers set sent_at = now() - interval '20 minutes', expires_at = now() - interval '5 minutes'
where inquiry_id = (select id from t_ids where name = 'preferred');
select expire_offers();
do $$
declare p uuid := (select id from t_ids where name = 'preferred');
begin
  assert (select status from offers where inquiry_id = p and home_id = '00000000-0000-4000-a000-000000000003') = 'wygasle', 'oferta nie wygasła';
  assert (select dispatch_round from inquiries where id = p) = 2, 'nie rozpoczęto drugiej rundy';
  assert (select count(*) from offers where inquiry_id = p and status = 'nowe') = 3, 'druga runda: 3 nowe oferty';
end $$;

update offers set expires_at = now() - interval '1 minute' where inquiry_id = (select id from t_ids where name = 'preferred') and status = 'nowe';
select expire_offers();
do $$
declare p uuid := (select id from t_ids where name = 'preferred');
begin
  -- W Łodzi zostały tylko zakłady, które już dostały zapytanie -> do opiekuna Ostoi.
  assert (select status from inquiries where id = p) = 'do_opiekuna', 'zapytanie powinno trafić do opiekuna';
end $$;

rollback;
