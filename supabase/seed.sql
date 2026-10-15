-- Ostoja: dane testowe. WSZYSTKIE osoby, zakłady i numery są fikcyjne.
-- Daty liczone względem dnia uruchomienia (strefa Europe/Warsaw).

insert into cities (slug, name, lat, lng) values
  ('lodz', 'Łódź', 51.7592, 19.4560),
  ('krakow', 'Kraków', 50.0647, 19.9450),
  ('warszawa', 'Warszawa', 52.2297, 21.0122),
  ('wroclaw', 'Wrocław', 51.1079, 17.0385),
  ('poznan', 'Poznań', 52.4064, 16.9252);

insert into price_catalog (item_key, label, for_burial, needs_ceremony, sort_order, optional) values
  ('transport',        'Odbiór i transport zmarłego',          'wszystkie',  false, 10, false),
  ('chlodnia',         'Przechowywanie w chłodni (do 5 dni)',   'wszystkie',  false, 20, false),
  ('przygotowanie',    'Przygotowanie i ubranie',               'wszystkie',  false, 30, false),
  ('trumna',           'Trumna',                                'tradycyjny', false, 40, false),
  ('trumna_kremacja',  'Trumna do kremacji i urna',             'kremacja',   false, 41, false),
  ('kremacja',         'Kremacja',                              'kremacja',   false, 50, false),
  ('ceremonia',        'Ceremonia, karawan, obsługa',           'wszystkie',  true,  60, false),
  ('formalnosci',      'Formalności i wniosek do ZUS',          'wszystkie',  false, 70, false),
  ('oprawa_muzyczna',  'Oprawa muzyczna',                       'wszystkie',  true,  80, true),
  ('wiazanka',         'Wiązanka od rodziny',                   'wszystkie',  false, 90, true),
  ('transmisja',       'Transmisja ceremonii online',           'wszystkie',  true,  95, true);

-- Użytkownicy (logowanie w trybie demo).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'anna@cisza.test',     '{"name":"Anna Cichońska"}'),
  ('00000000-0000-4000-8000-000000000002', 'ewa@cisza.test',      '{"name":"Ewa Rogalska"}'),
  ('00000000-0000-4000-8000-000000000003', 'adam@cisza.test',     '{"name":"Adam Sowiński"}'),
  ('00000000-0000-4000-8000-000000000004', 'piotr@podlipami.test','{"name":"Piotr Lipski"}'),
  ('00000000-0000-4000-8000-000000000005', 'kasia@kalina.test',   '{"name":"Katarzyna Kalinowska"}');

insert into funeral_homes (id, slug, name, nip, city_slug, address, phone, email, description,
                           lat, lng, has_farewell_hall, rating, reviews_count, verified_at) values
  ('00000000-0000-4000-a000-000000000001', 'dom-pogrzebowy-cisza', 'Dom Pogrzebowy Cisza', '7270000001', 'lodz',
   'ul. Przykładowa 12, 90-001 Łódź', '+48 600 000 001', 'biuro@cisza.test',
   'Rodzinny zakład od 1998 roku. Własna chłodnia i dwa karawany.', 51.7700, 19.4700, true, 4.8, 37, now()),
  ('00000000-0000-4000-a000-000000000002', 'uslugi-pogrzebowe-pod-lipami', 'Usługi Pogrzebowe Pod Lipami', '7270000002', 'lodz',
   'ul. Lipowa 5, 90-002 Łódź', '+48 600 000 002', 'kontakt@podlipami.test',
   'Własna sala pożegnań na 80 osób.', 51.7900, 19.4300, true, 4.9, 52, now()),
  ('00000000-0000-4000-a000-000000000003', 'zaklad-pogrzebowy-kalina', 'Zakład Pogrzebowy Kalina', '7270000003', 'lodz',
   'ul. Kalinowa 3, 93-001 Łódź', '+48 600 000 003', 'kalina@kalina.test',
   null, 51.7000, 19.4100, false, 4.6, 19, now()),
  ('00000000-0000-4000-a000-000000000004', 'zaklad-pogrzebowy-spokoj', 'Zakład Pogrzebowy Spokój', '7270000004', 'lodz',
   'ul. Cicha 8, 92-001 Łódź', '+48 600 000 004', 'spokoj@spokoj.test',
   null, 51.7450, 19.5200, false, 4.4, 11, now()),
  ('00000000-0000-4000-a000-000000000005', 'uslugi-pogrzebowe-brzozowa', 'Usługi Pogrzebowe Brzozowa', '6760000005', 'krakow',
   'ul. Brzozowa 1, 30-001 Kraków', '+48 600 000 005', 'brzozowa@brzozowa.test',
   null, 50.0700, 19.9300, true, 4.7, 24, now()),
  ('00000000-0000-4000-a000-000000000006', 'nowy-zaklad-niezweryfikowany', 'Nowy Zakład (niezweryfikowany)', '7270000006', 'lodz',
   'ul. Nowa 1, 90-003 Łódź', '+48 600 000 006', 'nowy@nowy.test',
   null, 51.7600, 19.4600, false, null, 0, null);

insert into memberships (user_id, home_id, role, display_name) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-a000-000000000001', 'wlasciciel', 'Anna Cichońska'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-a000-000000000001', 'biuro', 'Ewa Rogalska'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-a000-000000000001', 'ekipa', 'Adam Sowiński'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-a000-000000000002', 'wlasciciel', 'Piotr Lipski'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-a000-000000000003', 'wlasciciel', 'Katarzyna Kalinowska');

-- Cenniki (kremacja z ceremonią: Cisza 5 790 zł, Pod Lipami 6 350 zł, Kalina 4 980 zł).
insert into price_items (home_id, item_key, price_pln)
select h.id, v.item_key, v.price from (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 'transport', 600), ('00000000-0000-4000-a000-000000000001'::uuid, 'chlodnia', 340),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'przygotowanie', 500), ('00000000-0000-4000-a000-000000000001'::uuid, 'trumna', 2400),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'trumna_kremacja', 1900), ('00000000-0000-4000-a000-000000000001'::uuid, 'kremacja', 1050),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'ceremonia', 1150), ('00000000-0000-4000-a000-000000000001'::uuid, 'formalnosci', 250),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'oprawa_muzyczna', 450), ('00000000-0000-4000-a000-000000000001'::uuid, 'wiazanka', 280),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'transmisja', 390),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'transport', 650), ('00000000-0000-4000-a000-000000000002'::uuid, 'chlodnia', 360),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'przygotowanie', 550), ('00000000-0000-4000-a000-000000000002'::uuid, 'trumna', 2700),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'trumna_kremacja', 2100), ('00000000-0000-4000-a000-000000000002'::uuid, 'kremacja', 1100),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'ceremonia', 1350), ('00000000-0000-4000-a000-000000000002'::uuid, 'formalnosci', 240),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'wiazanka', 300),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'transport', 520), ('00000000-0000-4000-a000-000000000003'::uuid, 'chlodnia', 300),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'przygotowanie', 450), ('00000000-0000-4000-a000-000000000003'::uuid, 'trumna', 2000),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'trumna_kremacja', 1600), ('00000000-0000-4000-a000-000000000003'::uuid, 'kremacja', 1000),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'ceremonia', 900), ('00000000-0000-4000-a000-000000000003'::uuid, 'formalnosci', 210),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'transport', 580), ('00000000-0000-4000-a000-000000000004'::uuid, 'chlodnia', 320),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'przygotowanie', 480), ('00000000-0000-4000-a000-000000000004'::uuid, 'trumna', 2300),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'trumna_kremacja', 1750), ('00000000-0000-4000-a000-000000000004'::uuid, 'kremacja', 1050),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'ceremonia', 1100), ('00000000-0000-4000-a000-000000000004'::uuid, 'formalnosci', 250),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'transport', 620), ('00000000-0000-4000-a000-000000000005'::uuid, 'chlodnia', 350),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'przygotowanie', 520), ('00000000-0000-4000-a000-000000000005'::uuid, 'trumna', 2500),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'trumna_kremacja', 1900), ('00000000-0000-4000-a000-000000000005'::uuid, 'kremacja', 1100),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'ceremonia', 1200), ('00000000-0000-4000-a000-000000000005'::uuid, 'formalnosci', 250)
) as v(home, item_key, price)
join funeral_homes h on h.id = v.home;

insert into resources (id, home_id, kind, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'karawan', 'Karawan 1'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001', 'karawan', 'Karawan 2'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000001', 'sala', 'Sala pożegnań'),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000002', 'karawan', 'Karawan'),
  ('00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-000000000002', 'sala', 'Sala pożegnań');

-- Zapytania, zlecenia, kalendarz i dyżury dla Domu Pogrzebowego Cisza.
do $$
declare
  d0 timestamptz := (date_trunc('day', now() at time zone 'Europe/Warsaw')) at time zone 'Europe/Warsaw';
  cisza uuid := '00000000-0000-4000-a000-000000000001';
  anna uuid := '00000000-0000-4000-8000-000000000001';
  ewa  uuid := '00000000-0000-4000-8000-000000000002';
  adam uuid := '00000000-0000-4000-8000-000000000003';
  i1 uuid := '00000000-0000-4000-c000-000000000001';
  i2 uuid := '00000000-0000-4000-c000-000000000002';
  i3 uuid := '00000000-0000-4000-c000-000000000003';
  i4 uuid := '00000000-0000-4000-c000-000000000004';
  i5 uuid := '00000000-0000-4000-c000-000000000005';
  o1 uuid := '00000000-0000-4000-d000-000000000001';
  o2 uuid := '00000000-0000-4000-d000-000000000002';
  o3 uuid := '00000000-0000-4000-d000-000000000003';
  o4 uuid := '00000000-0000-4000-d000-000000000004';
  o5 uuid := '00000000-0000-4000-d000-000000000005';
  e uuid;
begin
  -- Nowe zapytanie czekające w skrzynce (kremacja, ceremonia świecka).
  insert into inquiries (id, city_slug, burial, ceremony, place_of_death, budget, guests_estimate,
                         contact_name, contact_phone, created_at)
  values (i1, 'lodz', 'kremacja', 'swiecka', 'szpital', 'zasilek', 40, 'Marek Testowy', '+48 500 100 200',
          now() - interval '2 minutes');
  insert into offers (inquiry_id, home_id, quote_pln, distance_km, sent_at, expires_at) values
    (i1, cisza, 5790, 2.1, now() - interval '2 minutes', now() + interval '13 minutes'),
    (i1, '00000000-0000-4000-a000-000000000002', 6350, 4.1, now() - interval '2 minutes', now() + interval '13 minutes'),
    (i1, '00000000-0000-4000-a000-000000000003', 4980, 7.8, now() - interval '2 minutes', now() + interval '13 minutes');

  -- Zapytania już przyjęte przez Ciszę.
  insert into inquiries (id, city_slug, burial, ceremony, place_of_death, contact_name, contact_phone, status, created_at) values
    (i2, 'lodz', 'kremacja',   'swiecka',   'szpital', 'Piotr Nowak',     '+48 500 100 201', 'przyjete', now() - interval '1 day 3 hours'),
    (i3, 'lodz', 'tradycyjny', 'religijna', 'dom',     'Joanna Kowalska', '+48 500 100 202', 'przyjete', now() - interval '20 hours'),
    (i4, 'lodz', 'kremacja',   'bez',       'dps',     'Tomasz Lis',      '+48 500 100 203', 'przyjete', now() - interval '12 days'),
    (i5, 'lodz', 'tradycyjny', 'religijna', 'szpital', 'Agata Mazur',     '+48 500 100 204', 'przyjete', now() - interval '3 hours');
  insert into offers (id, inquiry_id, home_id, status, quote_pln, distance_km, sent_at, expires_at, responded_at) values
    ('00000000-0000-4000-e000-000000000002', i2, cisza, 'przyjete', 5790, 2.1, now() - interval '1 day 3 hours', now() - interval '1 day 2 hours 45 minutes', now() - interval '1 day 2 hours 55 minutes'),
    ('00000000-0000-4000-e000-000000000003', i3, cisza, 'przyjete', 5240, 2.1, now() - interval '20 hours', now() - interval '19 hours 45 minutes', now() - interval '19 hours 52 minutes'),
    ('00000000-0000-4000-e000-000000000004', i4, cisza, 'przyjete', 4640, 2.1, now() - interval '12 days', now() - interval '12 days' + interval '15 minutes', now() - interval '12 days' + interval '6 minutes'),
    ('00000000-0000-4000-e000-000000000005', i5, cisza, 'przyjete', 5240, 2.1, now() - interval '3 hours', now() - interval '2 hours 45 minutes', now() - interval '2 hours 52 minutes');

  insert into orders (id, home_id, offer_id, stage, burial, ceremony, deceased_first_name, deceased_last_name,
                      born_on, died_at, principal_name, principal_phone, principal_email, zus_bank_account,
                      selected_items, total_pln, contract_signed_at, memorial_slug, memorial_published,
                      memorial_note, family_token, created_at) values
    (o1, cisza, '00000000-0000-4000-e000-000000000002', 'odbior', 'kremacja', 'swiecka', 'Halina', 'Nowak',
     '1948-03-12', now() - interval '1 day 5 hours', 'Piotr Nowak', '+48 500 100 201', 'piotr.nowak@example.test', null,
     array['transport','chlodnia','przygotowanie','trumna_kremacja','kremacja','ceremonia','formalnosci'], 5790,
     now() - interval '1 day', 'halina-nowak', true,
     'Mama, babcia i nauczycielka biologii. Najchętniej w ogrodzie, z książką i wnukami.',
     'demo-rodzina-nowak-0000000000000000000000000000', now() - interval '1 day 2 hours 55 minutes'),
    (o2, cisza, '00000000-0000-4000-e000-000000000003', 'przyjete', 'tradycyjny', 'religijna', 'Jan', 'Kowalski',
     '1941-07-02', now() - interval '22 hours', 'Joanna Kowalska', '+48 500 100 202', null, null,
     array['transport','chlodnia','przygotowanie','trumna','ceremonia','formalnosci'], 5240,
     null, null, false, null, 'demo-rodzina-kowalski-00000000000000000000000000', now() - interval '19 hours 52 minutes'),
    (o3, cisza, '00000000-0000-4000-e000-000000000004', 'rozliczenie', 'kremacja', 'bez', 'Teresa', 'Lis',
     '1950-11-20', now() - interval '13 days', 'Tomasz Lis', '+48 500 100 203', null, '12 3456 7890 1234 5678 9012 3456',
     array['transport','chlodnia','przygotowanie','trumna_kremacja','kremacja','formalnosci'], 4640,
     now() - interval '12 days', null, false, null, 'demo-rodzina-lis-000000000000000000000000000000', now() - interval '12 days'),
    (o4, cisza, null, 'ceremonia', 'tradycyjny', 'religijna', 'Maria', 'Zielińska',
     '1937-01-15', now() - interval '3 days', 'Krzysztof Zieliński', '+48 500 100 205', null, null,
     array['transport','chlodnia','przygotowanie','trumna','ceremonia','formalnosci'], 5240,
     now() - interval '2 days', null, false, null, 'demo-rodzina-zielinska-0000000000000000000000000', now() - interval '2 days 20 hours'),
    (o5, cisza, '00000000-0000-4000-e000-000000000005', 'przyjete', 'tradycyjny', 'religijna', 'Stanisław', 'Mazur',
     '1944-05-30', now() - interval '5 hours', 'Agata Mazur', '+48 500 100 204', null, null,
     array['transport','chlodnia','przygotowanie','trumna','ceremonia','formalnosci'], 5240,
     null, null, false, null, 'demo-rodzina-mazur-0000000000000000000000000000', now() - interval '2 hours 52 minutes');

  -- Zlecenie z umową zmienia etap triggerem tylko przy UPDATE; tu etapy ustawione ręcznie.

  insert into order_tasks (order_id, home_id, title, done, assignee, sort_order) values
    (o1, cisza, 'Zadzwonić do rodziny', true, ewa, 1),
    (o1, cisza, 'Wysłać rodzinie link do formularza', true, ewa, 2),
    (o1, cisza, 'Odbiór z prosektorium szpitala', false, adam, 3),
    (o1, cisza, 'Wybrać mistrza ceremonii świeckiej', false, ewa, 4),
    (o1, cisza, 'Uzupełnić numer konta do zasiłku', false, ewa, 5),
    (o2, cisza, 'Zadzwonić do rodziny', true, ewa, 1),
    (o2, cisza, 'Ustalić termin mszy z parafią', false, anna, 2),
    (o2, cisza, 'Podpisać umowę', false, anna, 3),
    (o5, cisza, 'Zadzwonić do rodziny', false, anna, 1),
    (o5, cisza, 'Wysłać rodzinie link do formularza', false, anna, 2),
    (o5, cisza, 'Ustalić termin pochówku', false, anna, 3);

  insert into events (id, home_id, order_id, kind, title, status, during, place, assignee) values
    ('00000000-0000-4000-f000-000000000001', cisza, o1, 'odbior', 'Odbiór: Halina Nowak', 'potwierdzony',
     tstzrange(d0 + interval '14 hours', d0 + interval '15 hours'), 'Prosektorium szpitala', adam),
    ('00000000-0000-4000-f000-000000000002', cisza, o1, 'kremacja', 'Kremacja: Halina Nowak', 'potwierdzony',
     tstzrange(d0 + interval '2 days 8 hours', d0 + interval '2 days 10 hours'), 'Krematorium', adam),
    ('00000000-0000-4000-f000-000000000003', cisza, o1, 'ceremonia', 'Ceremonia: Halina Nowak', 'potwierdzony',
     tstzrange(d0 + interval '3 days 11 hours', d0 + interval '3 days 12 hours'), 'Kaplica cmentarza komunalnego', anna),
    ('00000000-0000-4000-f000-000000000004', cisza, o2, 'ceremonia', 'Msza: Jan Kowalski', 'wstepny',
     tstzrange(d0 + interval '4 days 12 hours 30 minutes', d0 + interval '4 days 13 hours 30 minutes'), 'Kościół parafialny', anna),
    ('00000000-0000-4000-f000-000000000005', cisza, o2, 'pochowek', 'Pochówek: Jan Kowalski', 'wstepny',
     tstzrange(d0 + interval '4 days 13 hours 45 minutes', d0 + interval '4 days 14 hours 30 minutes'), 'Cmentarz parafialny', anna),
    ('00000000-0000-4000-f000-000000000006', cisza, o4, 'ceremonia', 'Ceremonia: Maria Zielińska', 'potwierdzony',
     tstzrange(d0 + interval '1 day 10 hours', d0 + interval '1 day 11 hours'), 'Sala pożegnań', anna),
    ('00000000-0000-4000-f000-000000000007', cisza, o4, 'pochowek', 'Pochówek: Maria Zielińska', 'potwierdzony',
     tstzrange(d0 + interval '1 day 11 hours 30 minutes', d0 + interval '1 day 12 hours 15 minutes'), 'Cmentarz komunalny', adam),
    -- Zbyt wczesny termin: pochówek niecałe 24 godziny po zgonie (kalendarz ostrzega).
    ('00000000-0000-4000-f000-000000000008', cisza, o5, 'pochowek', 'Pochówek: Stanisław Mazur', 'wstepny',
     tstzrange(now() + interval '15 hours', now() + interval '16 hours'), 'Cmentarz komunalny', anna),
    ('00000000-0000-4000-f000-000000000009', cisza, null, 'spotkanie', 'Dostawa trumien', 'potwierdzony',
     tstzrange(d0 + interval '1 day 8 hours', d0 + interval '1 day 9 hours'), 'Magazyn', adam);

  insert into bookings (event_id, resource_id, home_id, during) values
    ('00000000-0000-4000-f000-000000000001', '00000000-0000-4000-b000-000000000001', cisza, tstzrange(d0, d0)),
    ('00000000-0000-4000-f000-000000000003', '00000000-0000-4000-b000-000000000002', cisza, tstzrange(d0, d0)),
    ('00000000-0000-4000-f000-000000000006', '00000000-0000-4000-b000-000000000003', cisza, tstzrange(d0, d0)),
    ('00000000-0000-4000-f000-000000000007', '00000000-0000-4000-b000-000000000001', cisza, tstzrange(d0, d0)),
    ('00000000-0000-4000-f000-000000000004', '00000000-0000-4000-b000-000000000001', cisza, tstzrange(d0, d0));

  insert into duty_shifts (home_id, user_id, during) values
    (cisza, anna, tstzrange(d0 + interval '20 hours', d0 + interval '1 day 8 hours')),
    (cisza, ewa,  tstzrange(d0 + interval '1 day 20 hours', d0 + interval '2 days 8 hours')),
    (cisza, adam, tstzrange(d0 + interval '2 days 20 hours', d0 + interval '3 days 8 hours'));
end $$;
