-- Klepsydra: dane w zakładzie (RLS), publikacja tylko za zgodą rodziny, publiczny odczyt bez danych rodziny.
begin;
create temp table t (k text primary key, v text);
grant all on t to anon, authenticated, service_role;

set local role authenticated;

-- Właścicielka Ciszy zapisuje klepsydrę Jana Kowalskiego (religijna).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into obituaries (order_id, home_id, gender, sacraments, ceremony_place, cemetery_place, signature)
values ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-a000-000000000001', 'm', true,
        'w kościele pw. św. Anny w Łodzi', 'na cmentarzu parafialnym w Łodzi', 'Żona, dzieci i wnuki');

-- Klepsydry nie da się przypiąć do cudzego zlecenia.
do $$ begin
  begin
    insert into obituaries (order_id, home_id, gender) values ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-a000-000000000002', 'k');
    raise exception 'FAIL: klepsydra z cudzym zakładem';
  exception when insufficient_privilege or unique_violation or check_violation then null;
  end;
end $$;

-- Ekipa widzi (druk), ale nie zmienia.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from obituaries) = 1, 'ekipa nie widzi klepsydry';
  update obituaries set signature = 'Ekipa zmienia' where order_id = '00000000-0000-4000-d000-000000000002';
  assert (select signature from obituaries) = 'Żona, dzieci i wnuki', 'ekipa zmieniła klepsydrę';
  begin
    perform publish_obituary('00000000-0000-4000-d000-000000000002', true, true, 'jan-kowalski');
    raise exception 'FAIL: ekipa opublikowała';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Inny zakład nic nie widzi.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from obituaries) = 0, 'Pod Lipami widzi cudzą klepsydrę';
end $$;

-- Publikacja: bez zgody rodziny – odmowa; ze zgodą – adres z losową końcówką.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare v text;
begin
  begin
    perform publish_obituary('00000000-0000-4000-d000-000000000002', true, false, 'jan-kowalski');
    raise exception 'FAIL: publikacja bez zgody rodziny';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  v := publish_obituary('00000000-0000-4000-d000-000000000002', true, true, 'jan-kowalski');
  assert v ~ '^jan-kowalski-[a-z0-9]{6}$', 'adres klepsydry: ' || v;
  insert into t values ('slug', v);
  assert publish_obituary('00000000-0000-4000-d000-000000000002', true, true, 'inna-nazwa') = v, 'ponowna publikacja zmienia adres';
end $$;

-- Rodzina i internet: tylko treść klepsydry.
set local role anon;
do $$
declare d jsonb := public_obituary((select v from t where k = 'slug'));
begin
  assert d->>'last_name' = 'Kowalski', 'brak klepsydry dla anon';
  assert (d->>'age')::int = 85, 'wiek: ' || coalesce(d->>'age', 'null');
  assert d->>'signature' = 'Żona, dzieci i wnuki', 'podpis';
  assert jsonb_array_length(d->'events') = 2, 'terminy z kalendarza';
  assert d::text not like '%500 100 202%' and d::text not like '%Joanna%' and d::text not like '%family_token%', 'dane rodziny w publicznej klepsydrze';
  assert not d ? 'born_on', 'pełna data urodzenia w publicznej klepsydrze';
  assert public_obituary('jan-kowalski-zzzzzz') is null, 'zgadnięty adres';
  begin
    perform * from obituaries;
    raise exception 'FAIL: anon czyta tabelę klepsydr';
  exception when insufficient_privilege then null;
  end;
  assert (family_get_order('demo-rodzina-kowalski-00000000000000000000000000')->>'obituary_slug') = (select v from t where k = 'slug'),
    'rodzina nie dostaje linku do klepsydry';
end $$;
set local role authenticated;

-- Wycofanie publikacji.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select publish_obituary('00000000-0000-4000-d000-000000000002', false, false, null);
set local role anon;
do $$ begin
  assert public_obituary((select v from t where k = 'slug')) is null, 'wycofana klepsydra dalej publiczna';
  assert (family_get_order('demo-rodzina-kowalski-00000000000000000000000000')->>'obituary_slug') is null, 'link po wycofaniu';
end $$;

-- 30 dni po ostatniej uroczystości klepsydra znika z sieci.
reset role;
update obituaries set published_at = now() where order_id = '00000000-0000-4000-d000-000000000002';
update events set during = tstzrange(now() - interval '32 days', now() - interval '31 days') where order_id = '00000000-0000-4000-d000-000000000002';
set local role anon;
do $$ begin
  assert public_obituary((select v from t where k = 'slug')) is null, 'stara klepsydra dalej publiczna';
end $$;

rollback;
