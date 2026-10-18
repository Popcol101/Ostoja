-- Test penetracyjny bazy (RLS / IDOR): użytkownik zakładu B (Pod Lipami, Piotr) i ekipa zakładu A (Adam)
-- próbują czytać i zmieniać dane zakładu A (Cisza). Każda linia wyniku z „PODATNOŚĆ” to błąd.
-- Uruchomienie: psql … -v ON_ERROR_STOP=0 -f tests/security/rls_sweep.sql (na bazie testowej, w transakcji z rollbackiem).
\set QUIET on
\pset tuples_only on
begin;

create temporary table wyniki (test text, wynik text) on commit drop;
grant all on wyniki to authenticated, anon;

-- ===== Obcy zakład (Piotr, właściciel Pod Lipami) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

do $$
declare
  a constant uuid := '00000000-0000-4000-a000-000000000001';
  t text; n bigint;
begin
  foreach t in array array['bookings','calendar_events','billing_lines','duty_shifts','events','memberships','notifications',
                           'obituaries','offers','order_tasks','orders','price_items','push_subscriptions','resources'] loop
    execute format('select count(*) from %I where home_id = $1', t) into n using a;
    insert into wyniki values ('obcy czyta ' || t, case when n = 0 then 'ok' else 'PODATNOŚĆ: widzi ' || n end);
  end loop;
  foreach t in array array['bookings','duty_shifts','events','order_tasks','orders','price_items','resources','obituaries'] loop
    begin
      execute format('update %I set home_id = home_id where home_id = $1', t) using a;
      get diagnostics n = row_count;
      insert into wyniki values ('obcy zmienia ' || t, case when n = 0 then 'ok' else 'PODATNOŚĆ: zmienił ' || n end);
    exception when others then insert into wyniki values ('obcy zmienia ' || t, 'ok (' || sqlstate || ')');
    end;
  end loop;
  foreach t in array array['bookings','duty_shifts','events','order_tasks','price_items','resources','push_subscriptions'] loop
    begin
      execute format('delete from %I where home_id = $1', t) using a;
      get diagnostics n = row_count;
      insert into wyniki values ('obcy usuwa ' || t, case when n = 0 then 'ok' else 'PODATNOŚĆ: usunął ' || n end);
    exception when others then insert into wyniki values ('obcy usuwa ' || t, 'ok (' || sqlstate || ')');
    end;
  end loop;
  -- Wstawienie wiersza z cudzym home_id.
  begin
    insert into resources (home_id, kind, name) values (a, 'sala', 'atak');
    insert into wyniki values ('obcy wstawia resources do A', 'PODATNOŚĆ: wstawił');
  exception when others then insert into wyniki values ('obcy wstawia resources do A', 'ok (' || sqlstate || ')');
  end;
  begin
    insert into price_items (home_id, catalog_code, price_pln) select a, code, 1 from price_catalog limit 1;
    insert into wyniki values ('obcy wstawia price_items do A', 'PODATNOŚĆ: wstawił');
  exception when others then insert into wyniki values ('obcy wstawia price_items do A', 'ok (' || sqlstate || ')');
  end;
  -- Przeniesienie własnego wiersza do cudzego zakładu.
  begin
    update resources set home_id = a where home_id = '00000000-0000-4000-a000-000000000002';
    get diagnostics n = row_count;
    insert into wyniki values ('obcy przenosi swój zasób do A', case when n = 0 then 'ok' else 'PODATNOŚĆ: przeniósł ' || n end);
  exception when others then insert into wyniki values ('obcy przenosi swój zasób do A', 'ok (' || sqlstate || ')');
  end;
  -- Zmiana cudzego zakładu (profil).
  begin
    update funeral_homes set phone = '+48 999 999 999' where id = a;
    get diagnostics n = row_count;
    insert into wyniki values ('obcy zmienia profil A', case when n = 0 then 'ok' else 'PODATNOŚĆ: zmienił' end);
  exception when others then insert into wyniki values ('obcy zmienia profil A', 'ok (' || sqlstate || ')');
  end;
  -- Weryfikacja własnego zakładu (tylko administrator).
  begin
    update funeral_homes set verified_at = now() where id = '00000000-0000-4000-a000-000000000002';
    get diagnostics n = row_count;
    insert into wyniki values ('właściciel sam się weryfikuje', case when n = 0 then 'ok' else 'PODATNOŚĆ' end);
  exception when others then insert into wyniki values ('właściciel sam się weryfikuje', 'ok (' || sqlstate || ')');
  end;
  -- Tabele, do których rola nie powinna mieć dostępu wcale.
  foreach t in array array['inquiries','inquiry_drafts','invitations','platform_admins','admin_audit','app_errors','rate_limits',
                           'home_appeals','home_status_log'] loop
    begin
      execute format('select count(*) from %I', t) into n;
      insert into wyniki values ('zakład czyta ' || t, case when n = 0 then 'ok (pusto)' else 'PODATNOŚĆ: ' || n end);
    exception when others then insert into wyniki values ('zakład czyta ' || t, 'ok (' || sqlstate || ')');
    end;
  end loop;
  -- auth.users
  begin
    execute 'select count(*) from auth.users' into n;
    insert into wyniki values ('zakład czyta auth.users', 'PODATNOŚĆ: ' || n);
  exception when others then insert into wyniki values ('zakład czyta auth.users', 'ok (' || sqlstate || ')');
  end;
end $$;

-- Funkcje z identyfikatorem cudzego zlecenia lub zakładu.
do $$
declare
  o uuid; n int;
begin
  select id into o from orders where false; -- RLS: obcy nie zna id, bierzemy z seeda (tryb postgres poniżej)
end $$;
reset role;

-- id zlecenia zakładu A (Cisza) do prób IDOR przez funkcje
create temporary table cel as select id from orders where home_id = '00000000-0000-4000-a000-000000000001' limit 1;
grant select on cel to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

do $$
declare
  o uuid := (select id from cel);
  r text; fn text;
begin
  foreach fn in array array[
    'select publish_obituary(%L::uuid, true, true, ''x'')',
    'select order_set_stage(%L::uuid, ''w_trakcie'')',
    'select send_family_link_sms(%L::uuid)',
    'select mark_contract_signed(%L::uuid)',
    'select admin_home_history(%L::uuid)',
    'select my_home_status(%L::uuid)',
    'select admin_suspend_home(%L::uuid, ''ceny'', ''aaaaaaaaaaaaaaaaaaaaaaaaaaaa'')'
  ] loop
    begin
      execute format(fn, case when fn like '%home%' then '00000000-0000-4000-a000-000000000001' else o::text end) into r;
      insert into wyniki values ('obcy: ' || split_part(fn, '(', 1), 'PODATNOŚĆ? zwróciło: ' || coalesce(left(r, 60), 'null'));
    exception
      when undefined_function then insert into wyniki values ('obcy: ' || split_part(fn, '(', 1), 'brak funkcji (pominięte)');
      when others then insert into wyniki values ('obcy: ' || split_part(fn, '(', 1), 'ok (' || sqlstate || ')');
    end;
  end loop;
end $$;

-- ===== Ekipa własnego zakładu (Adam, Cisza) – nie zmienia profilu, cennika, zespołu =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
declare a constant uuid := '00000000-0000-4000-a000-000000000001'; n bigint;
begin
  begin
    update funeral_homes set phone = '+48 999 999 999' where id = a;
    get diagnostics n = row_count;
    insert into wyniki values ('ekipa zmienia profil', case when n = 0 then 'ok' else 'PODATNOŚĆ' end);
  exception when others then insert into wyniki values ('ekipa zmienia profil', 'ok (' || sqlstate || ')'); end;
  begin
    update price_items set price_pln = 1 where home_id = a;
    get diagnostics n = row_count;
    insert into wyniki values ('ekipa zmienia cennik', case when n = 0 then 'ok' else 'PODATNOŚĆ: ' || n end);
  exception when others then insert into wyniki values ('ekipa zmienia cennik', 'ok (' || sqlstate || ')'); end;
  begin
    perform create_invitation('wlamywacz@example.com', 'wlasciciel', 'Atak');
    insert into wyniki values ('ekipa zaprasza właściciela', 'PODATNOŚĆ');
  exception when others then insert into wyniki values ('ekipa zaprasza właściciela', 'ok (' || sqlstate || ')'); end;
  begin
    update memberships set role = 'wlasciciel' where user_id = '00000000-0000-4000-8000-000000000003';
    get diagnostics n = row_count;
    insert into wyniki values ('ekipa awansuje się na właściciela', case when n = 0 then 'ok' else 'PODATNOŚĆ' end);
  exception when others then insert into wyniki values ('ekipa awansuje się na właściciela', 'ok (' || sqlstate || ')'); end;
  begin
    update orders set principal_phone = '+48 111 111 111' where home_id = a;
    get diagnostics n = row_count;
    insert into wyniki values ('ekipa zmienia telefon rodziny w zleceniu', case when n = 0 then 'ok' else 'UWAGA: zmieniła ' || n || ' (sprawdź, czy zamierzone)' end);
  exception when others then insert into wyniki values ('ekipa zmienia telefon rodziny w zleceniu', 'ok (' || sqlstate || ')'); end;
end $$;

-- ===== Anonim (strona dla rodzin) =====
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare t text; n bigint;
begin
  foreach t in array array['orders','inquiries','funeral_homes','memberships','offers','events','obituaries','invitations','push_subscriptions'] loop
    begin
      execute format('select count(*) from %I', t) into n;
      insert into wyniki values ('anonim czyta ' || t, case when n = 0 then 'ok (pusto)' else 'PODATNOŚĆ: ' || n end);
    exception when others then insert into wyniki values ('anonim czyta ' || t, 'ok (' || sqlstate || ')'); end;
  end loop;
  begin
    perform family_get_order('nieistniejacy-token-0000000000000000000000');
    insert into wyniki values ('anonim: family_get_order z fałszywym tokenem', 'ok (pusto)');
  exception when others then insert into wyniki values ('anonim: family_get_order z fałszywym tokenem', 'ok (' || sqlstate || ')'); end;
end $$;

reset role;
select test || ' → ' || wynik from wyniki order by (wynik like 'PODATNOŚĆ%' or wynik like 'UWAGA%') desc, test;
rollback;
