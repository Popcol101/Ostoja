-- Panel administratora: tylko administratorzy Ostoi; dodanie partnera, weryfikacja, zaproszenie, dziennik.
begin;
create temp table t (k text primary key, v text);
grant all on t to anon, authenticated, service_role;

set local role authenticated;

-- Właścicielka zakładu nie jest administratorem.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  assert not is_platform_admin(), 'Anna jako admin';
  begin
    perform * from admin_homes();
    raise exception 'FAIL: zakład widzi admin_homes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from admin_escalations();
    raise exception 'FAIL: zakład widzi zapytania do opiekuna';
  exception when insufficient_privilege then null;
  end;
  begin
    perform admin_create_home('{"name":"X"}');
    raise exception 'FAIL: zakład dodał partnera';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from platform_admins;
    raise exception 'FAIL: odczyt platform_admins';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Administratorka.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
do $$
declare v_id uuid;
begin
  assert is_platform_admin(), 'Ola nie jest adminem';
  assert (select count(*) from admin_homes()) = 6, 'admin widzi wszystkie 6 zakładów';
  -- admin nie jest członkiem zakładu: RLS nie daje mu zleceń
  assert (select count(*) from orders) = 0, 'admin widzi zlecenia przez RLS';

  begin
    perform admin_create_home('{"name":"Zły NIP","nip":"123","city_slug":"lodz","address":"a","phone":"1","email":"a@b.pl"}');
    raise exception 'FAIL: przyjęto zły NIP';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  v_id := admin_create_home('{"name":"Zakład Pogrzebowy Wierzba","nip":"725-000-11-22","city_slug":"lodz",
    "address":"ul. Wierzbowa 1, 90-001 Łódź","phone":"+48 600 000 010","email":"Biuro@Wierzba.test","slug":"zaklad-pogrzebowy-wierzba"}');
  insert into t values ('home', v_id::text);
  assert (select verified_at from admin_homes() where id = v_id) is null, 'nowy zakład od razu zweryfikowany';
  assert (select email from admin_homes() where id = v_id) = 'biuro@wierzba.test', 'e-mail nieznormalizowany';
  assert not (select price_complete from admin_homes() where id = v_id), 'pusty cennik uznany za pełny';
  -- niezweryfikowany zakład nie pojawia się rodzinom
  assert not exists (select 1 from search_homes('lodz', 'kremacja', 'bez') where home_id = v_id), 'niezweryfikowany na liście ofert';

  begin
    perform admin_create_home('{"name":"Duplikat","nip":"7250001122","city_slug":"lodz","address":"a","phone":"1","email":"a@b.pl"}');
    raise exception 'FAIL: duplikat NIP';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  insert into t values ('token', admin_invite(v_id, 'wlasciciel@wierzba.test', 'wlasciciel', 'Jan Wierzbowski'));
  assert (select count(*) from admin_home_people(v_id) where kind = 'zaproszenie') = 1, 'brak zaproszenia właściciela';

  perform admin_set_verified(v_id, true);
  assert (select verified_at from admin_homes() where id = v_id) is not null, 'weryfikacja nie zadziałała';
  perform admin_set_verified(v_id, false);
  assert (select verified_at from admin_homes() where id = v_id) is null, 'wstrzymanie nie zadziałało';

  assert (select count(*) from admin_escalations() where handled_at is null) = 1, 'brak zapytania do opiekuna';
  assert (select contact_phone from admin_escalations() limit 1) = '+48 500 100 299', 'brak telefonu w eskalacji';
  perform admin_mark_handled((select id from admin_escalations() limit 1), 'Oddzwoniono, rodzina wybrała zakład');
  assert (select handled_at from admin_escalations() limit 1) is not null, 'nie oznaczono jako obsłużone';

  assert (select count(*) from admin_billing(current_date)) >= 1, 'brak rozliczeń w bieżącym miesiącu';
end $$;

-- Dziennik zapisał działania.
reset role;
do $$ begin
  assert (select count(*) from admin_audit where admin_id = '00000000-0000-4000-8000-000000000009') >= 6, 'dziennik niekompletny';
  assert exists (select 1 from admin_audit where action = 'odczyt zapytań do opiekuna'), 'brak wpisu o odczycie telefonów';
end $$;

-- Właściciel przyjmuje zaproszenie i zarządza swoim zakładem.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000b1', 'wlasciciel@wierzba.test');
set local role service_role;
select accept_invitation((select v from t where k = 'token'), '00000000-0000-4000-8000-0000000000b1');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from funeral_homes) = 1, 'nowy właściciel nie widzi swojego zakładu';
  assert (select count(*) from team_members() where role = 'wlasciciel') = 1, 'brak roli właściciela';
end $$;

rollback;
