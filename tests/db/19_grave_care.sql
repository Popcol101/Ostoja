-- Opieka nad grobem: wycena, warunek „da się dojść do grobu”, płatność testowa, panel usługodawcy, zdjęcie.
begin;
create temp table t (k text primary key, v text);
grant all on t to anon, authenticated, service_role;

-- Wycena wg cennika Ostoi.
do $$ begin
  assert grave_quote('[{"service":"znicz","products":[{"key":"znicz_1d","qty":2}]}]') = 60, 'znicz: 40 + 2 × 10';
  assert grave_quote('[{"service":"kwiaty","products":[{"key":"roze","qty":1}]},{"service":"sprzatanie"}]') = 160, 'kwiaty 40 + 60, sprzątanie 60';
  begin
    perform grave_quote('[{"service":"sprzatanie"},{"service":"sprzatanie"}]');
    raise exception 'FAIL: ta sama usługa dwa razy';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin
    perform grave_quote('[{"service":"znicz","products":[{"key":"roze","qty":1}]}]');
    raise exception 'FAIL: kwiaty jako znicz';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin
    perform grave_quote('[{"service":"znicz","products":[]}]');
    raise exception 'FAIL: znicz bez znicza';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;

-- Lista cmentarzy dla każdego; anon nie złoży zamówienia z pominięciem serwera.
set local role anon;
do $$ begin
  assert (select has_provider from grave_care_cemeteries() where name = 'Cmentarz Komunalny Doły'), 'Doły bez usługodawcy';
  assert not (select has_provider from grave_care_cemeteries() where name = 'Cmentarz Oliwski'), 'Oliwa z usługodawcą';
  begin
    perform create_grave_order('{}');
    raise exception 'FAIL: anon składa zamówienie bezpośrednio';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Serwer: zamówienia.
reset role;
set local role service_role;
do $$
declare
  v_doly uuid := (select id from cemeteries where name = 'Cmentarz Komunalny Doły');
  v_test uuid := '00000000-0000-4000-c300-000000000001';
  v_oliwa uuid := (select id from cemeteries where name = 'Cmentarz Oliwski');
  base jsonb := '{"deceased_name":"Jan Testowy","customer_name":"Ewa Testowa","customer_email":"ewa@example.test",
                  "items":[{"service":"znicz","products":[{"key":"znicz_1d","qty":1}]}]}';
  tok text;
begin
  -- Cmentarz bez wyszukiwarki i bez GPS – nie da się ustalić drogi do grobu.
  begin
    perform create_grave_order(base || jsonb_build_object('cemetery_id', v_test, 'grave_section', '12', 'grave_number', '5'));
    raise exception 'FAIL: zamówienie bez sposobu dojścia do grobu';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Ten sam cmentarz z GPS – można.
  perform create_grave_order(base || jsonb_build_object('cemetery_id', v_test, 'grave_lat', 51.75, 'grave_lng', 19.45));
  -- Wyszukiwarka, ale bez kwatery – odmowa.
  begin
    perform create_grave_order(base || jsonb_build_object('cemetery_id', v_doly));
    raise exception 'FAIL: zamówienie bez kwatery i numeru';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Cmentarz bez usługodawcy – odmowa.
  begin
    perform create_grave_order(base || jsonb_build_object('cemetery_id', v_oliwa, 'grave_section', 'A', 'grave_number', '1'));
    raise exception 'FAIL: zamówienie bez usługodawcy';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  -- Zlecenie stałe na Dołach.
  tok := create_grave_order(base || jsonb_build_object('cemetery_id', v_doly, 'grave_section', 'IV', 'grave_row', '3', 'grave_number', '17',
                                                       'frequency', 'co_miesiac', 'first_on', (current_date + 2)::text));
  assert (select total_pln from grave_orders where token = tok) = 50, 'cena 40 + 10';
  assert (grave_order_by_token(tok)->>'status') = 'do_zaplaty', 'status przed płatnością';
  perform mark_grave_order_paid(tok, 'test', 'TEST-1');
  assert (grave_order_by_token(tok)->'provider'->>'name') like 'Spokój%', 'nie przydzielono usługodawcy';
  assert jsonb_array_length(grave_order_by_token(tok)->'visits') = 1, 'brak pierwszej wizyty';
  insert into t values ('tok', tok);
end $$;

-- Zakład pogrzebowy nie widzi zleceń usługodawcy; usługodawca widzi wizytę bez danych kontaktowych klienta.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from provider_visits()) = 0, 'zakład widzi wizyty usługodawcy';
  begin
    perform admin_create_provider('{"name":"Ktoś","nip":"1234567890","phone":"600000000","email":"a@b.pl","city":"Łódź"}');
    raise exception 'FAIL: zakład dodał usługodawcę';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from grave_orders;
    raise exception 'FAIL: odczyt tabeli zamówień';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare v uuid; nxt date;
begin
  assert (select count(*) from provider_visits() where status = 'zaplanowana') = 1, 'usługodawca nie widzi wizyty (tylko opłacone zamówienia)';
  select visit_id into v from provider_visits() where grave_number = '17';
  begin
    perform complete_grave_visit(v, null, 'image/jpeg', null);
    raise exception 'FAIL: wykonanie bez zdjęcia';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  nxt := complete_grave_visit(v, decode(repeat('ff', 2000), 'hex'), 'image/jpeg', 'Znicz zapalony');
  assert nxt is not null, 'zlecenie stałe bez następnej wizyty';
  assert (select count(*) from provider_visits() where status = 'zaplanowana' and grave_number = '17') = 1, 'brak następnej wizyty w panelu';
  begin
    perform complete_grave_visit(v, decode(repeat('ff', 2000), 'hex'), 'image/jpeg', null);
    raise exception 'FAIL: podwójne zamknięcie wizyty';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;

-- Klient ogląda zdjęcie przez swój link; z cudzym tokenem – nic.
set local role anon;
do $$ begin
  assert (select count(*) from grave_visit_photo((select v from t where k = 'tok'),
           ((grave_order_by_token((select v from t where k = 'tok'))->'visits'->1->>'id'))::uuid)) = 1, 'klient nie widzi zdjęcia';
  assert (select count(*) from grave_visit_photo('zly-token', gen_random_uuid())) = 0, 'zdjęcie dla złego tokenu';
end $$;

-- Terminy zleceń stałych.
reset role;
do $$ begin
  assert next_grave_date('swieta', '2026-11-01') = '2026-12-23', 'święta: po 1.11 → Wigilia';
  assert next_grave_date('swieta', '2026-12-23') = '2027-10-31', 'święta: po Wigilii → 31.10';
  assert next_grave_date('co_miesiac', '2026-01-31') = '2026-02-28', 'co miesiąc';
  assert next_grave_date('jednorazowo', '2026-01-31') is null, 'jednorazowo bez następnej';
end $$;
rollback;
