-- Weryfikacja numeru rodziny: zapytanie powstaje dopiero po poprawnym kodzie z SMS-a.
begin;
create temp table t (k text primary key, v text);
grant all on t to anon, service_role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

-- Bez kodu nie da się utworzyć zapytania.
do $$ begin
  perform create_inquiry('{"city_slug":"lodz"}');
  raise exception 'FAIL: anon wywołał create_inquiry';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform * from inquiry_drafts;
  raise exception 'FAIL: odczyt inquiry_drafts';
exception when insufficient_privilege then null;
end $$;
-- Kod SMS dostaje tylko serwer – przez publiczne API (rola anon) nie da się go pobrać.
do $$ begin
  perform start_inquiry('{"city_slug":"lodz"}');
  raise exception 'FAIL: anon wywołał start_inquiry';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform confirm_inquiry(gen_random_uuid(), '123456');
  raise exception 'FAIL: anon wywołał confirm_inquiry';
exception when insufficient_privilege then null;
end $$;

set local role service_role;

insert into t select 'draft', draft_id::text from start_inquiry(jsonb_build_object(
  'city_slug', 'lodz', 'burial', 'kremacja', 'ceremony', 'religijna', 'place_of_death', 'szpital',
  'contact_name', 'Ala Testowa', 'contact_phone', '+48 600 100 300',
  'preferred_home_id', '00000000-0000-4000-a000-000000000001'));

do $$
declare d uuid := (select v from t where k = 'draft')::uuid;
        r record;
begin
  assert (select phone_hint from draft_info(d)) = '+48 600 ••• 300', 'maska numeru';
  assert (select resend_in from draft_info(d)) > 0, 'ponowna wysyłka od razu';
  -- zły kod: licznik prób rośnie, zapytania brak
  select * into r from confirm_inquiry(d, '000000');
  if r.status = 'ok' then
    raise exception 'FAIL: przypadkowo trafiony kod';
  end if;
  assert r.status = 'zly' and r.attempts_left = 4, 'zły kod: status';
  select * into r from confirm_inquiry(d, 'abc');
  assert r.attempts_left = 3, 'licznik prób';
  begin
    perform resend_inquiry_code(d);
    raise exception 'FAIL: ponowna wysyłka przed minutą';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- Właściciel bazy podgląda kod (test) – na produkcji kod zna tylko SMS.
reset role;
do $$
declare d uuid := (select v from t where k = 'draft')::uuid;
        code text;
        r record;
        n_before int := (select count(*) from inquiries);
begin
  -- podmień kod na znany, żeby sprawdzić poprawną ścieżkę
  update inquiry_drafts set code_hash = sms_code_hash(id, '123456') where id = d;
  set local role service_role;
  select * into r from confirm_inquiry(d, '123456');
  assert r.status = 'ok', 'poprawny kod nie przeszedł';
  reset role;
  assert (select count(*) from inquiries) = n_before + 1, 'nie powstało zapytanie';
  assert (select phone_verified_at from inquiries where id = r.inquiry_id) is not null, 'brak znacznika weryfikacji';
  assert (select contact_phone from inquiries where id = r.inquiry_id) = '+48 600 100 300', 'zły telefon w zapytaniu';
  assert (select count(*) from offers where inquiry_id = r.inquiry_id) = 1, 'zapytanie nie trafiło do zakładu';
  assert not exists (select 1 from inquiry_drafts where id = d), 'szkic nie skasowany';
  set local role service_role;
  select * into r from confirm_inquiry(d, '123456');
  assert r.status = 'wygasl', 'drugie użycie kodu';
end $$;

-- 5 złych prób blokuje szkic.
reset role;
set local role service_role;
insert into t select 'd2', draft_id::text from start_inquiry(jsonb_build_object(
  'city_slug', 'lodz', 'burial', 'kremacja', 'ceremony', 'bez', 'place_of_death', 'dom',
  'contact_name', 'Ola Testowa', 'contact_phone', '+48 600 100 301'));
do $$
declare d uuid := (select v from t where k = 'd2')::uuid;
begin
  for i in 1..5 loop perform confirm_inquiry(d, 'xxxxxx'); end loop;
  assert (select status from confirm_inquiry(d, '000001')) = 'zablokowany', 'brak blokady po 5 próbach';
end $$;

-- Limit 3 szkiców na numer w godzinie.
do $$ begin
  perform start_inquiry(jsonb_build_object('city_slug','lodz','burial','kremacja','ceremony','bez','place_of_death','dom',
    'contact_name','X Y','contact_phone','+48 600 100 301'));
  perform start_inquiry(jsonb_build_object('city_slug','lodz','burial','kremacja','ceremony','bez','place_of_death','dom',
    'contact_name','X Y','contact_phone','+48 600 100 301'));
  begin
    perform start_inquiry(jsonb_build_object('city_slug','lodz','burial','kremacja','ceremony','bez','place_of_death','dom',
      'contact_name','X Y','contact_phone','+48 600 100 301'));
    raise exception 'FAIL: czwarty kod w godzinie';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

rollback;
