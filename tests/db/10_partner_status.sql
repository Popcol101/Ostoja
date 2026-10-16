-- Wstrzymanie zakładu z uzasadnieniem i odwołanie (rozporządzenie P2B 2019/1150, art. 4 i 11).
begin;
set local role authenticated;

-- Administratorka: bez uzasadnienia nie wstrzyma zakładu.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
do $$ begin
  begin
    perform admin_set_verified('00000000-0000-4000-a000-000000000002', false);
    raise exception 'FAIL: wstrzymanie bez uzasadnienia';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform admin_suspend_home('00000000-0000-4000-a000-000000000002', 'ceny', 'za krótko');
    raise exception 'FAIL: zbyt krótkie uzasadnienie';
  exception when raise_exception or check_violation then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform admin_suspend_home('00000000-0000-4000-a000-000000000002', 'ceny',
    'Trzy rodziny w październiku dostały kosztorys o 900 zł wyższy niż cena w Ostoi.');
  assert (select verified_at from admin_homes() where id = '00000000-0000-4000-a000-000000000002') is null, 'zakład nie wstrzymany';
  assert (select count(*) from admin_home_history('00000000-0000-4000-a000-000000000002')) = 1, 'brak wpisu w historii';
end $$;

-- Rodzina nie widzi wstrzymanego zakładu.
set local role anon;
do $$ begin
  assert not exists (select 1 from search_homes('lodz', 'tradycyjny', 'religijna') where name like '%Pod Lipami%'),
    'wstrzymany zakład na liście ofert';
end $$;
set local role authenticated;

-- Inny zakład nie widzi cudzego statusu ani nie złoży odwołania.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  begin
    perform * from my_home_status('00000000-0000-4000-a000-000000000002');
    raise exception 'FAIL: Anna widzi status Pod Lipami';
  exception when insufficient_privilege then null;
  end;
  assert (select status from my_home_status('00000000-0000-4000-a000-000000000001')) = 'zweryfikowany', 'status Ciszy';
  begin
    perform submit_appeal('00000000-0000-4000-a000-000000000001', 'Odwołanie od czegoś, czego nie było w ogóle.');
    raise exception 'FAIL: odwołanie bez wstrzymania';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform * from admin_appeals();
    raise exception 'FAIL: zakład widzi odwołania';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Właściciel wstrzymanego zakładu widzi uzasadnienie i składa jedno odwołanie naraz.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare s record;
begin
  select * into s from my_home_status('00000000-0000-4000-a000-000000000002');
  assert s.status = 'wstrzymany', 'status po wstrzymaniu';
  assert s.ground = 'ceny' and s.reason like 'Trzy rodziny%', 'brak uzasadnienia dla zakładu';
  perform submit_appeal('00000000-0000-4000-a000-000000000002',
    'Kosztorysy obejmowały dodatkowy przewóz z Tarnowa, na który rodziny się zgodziły. Załączamy podpisane umowy.');
  begin
    perform submit_appeal('00000000-0000-4000-a000-000000000002', 'Drugie odwołanie w tej samej sprawie, zanim padła odpowiedź.');
    raise exception 'FAIL: drugie otwarte odwołanie';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  assert (select appeal_body from my_home_status('00000000-0000-4000-a000-000000000002')) like 'Kosztorysy%', 'brak odwołania w statusie';
  begin
    insert into home_appeals (home_id, author_name, body) values ('00000000-0000-4000-a000-000000000002', 'X', 'Bezpośredni zapis do tabeli odwołań');
    raise exception 'FAIL: bezpośredni zapis do home_appeals';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Pracownik ekipy nie składa odwołań w imieniu zakładu (sprawdzane na Ciszy po jej wstrzymaniu).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
select admin_suspend_home('00000000-0000-4000-a000-000000000001', 'na_wniosek', 'Na prośbę właścicielki: urlop zakładu od 20 do 27 października.');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ begin
  begin
    perform submit_appeal('00000000-0000-4000-a000-000000000001', 'Pracownik ekipy próbuje złożyć odwołanie zakładu.');
    raise exception 'FAIL: ekipa złożyła odwołanie';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Administratorka odpowiada i przywraca zakład.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
do $$
declare v_appeal uuid;
begin
  assert (select admin_appeals_waiting()) = 1, 'licznik odwołań';
  select id into v_appeal from admin_appeals() where answered_at is null;
  begin
    perform admin_answer_appeal(v_appeal, true, 'ok');
    raise exception 'FAIL: odpowiedź bez uzasadnienia';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform admin_answer_appeal(v_appeal, true, 'Umowy potwierdzają zgodę rodzin na przewóz. Przywracamy zakład na listę ofert.');
  assert (select verified_at from admin_homes() where id = '00000000-0000-4000-a000-000000000002') is not null, 'zakład nie przywrócony';
  assert (select admin_appeals_waiting()) = 0, 'odwołanie dalej otwarte';
  assert (select count(*) from admin_home_history('00000000-0000-4000-a000-000000000002')) = 2, 'brak wpisu o przywróceniu';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare s record;
begin
  select * into s from my_home_status('00000000-0000-4000-a000-000000000002');
  assert s.status = 'zweryfikowany', 'status po przywróceniu';
  assert s.appeal_answer like 'Umowy potwierdzają%' and s.appeal_outcome = 'przywrocony', 'zakład nie widzi odpowiedzi';
end $$;

-- Dziennik administratora.
reset role;
do $$ begin
  assert (select count(*) from admin_audit where action in ('wstrzymanie zakładu', 'odpowiedź na odwołanie')) = 3, 'dziennik';
end $$;

rollback;
