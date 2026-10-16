-- Wnioski osób (RODO art. 15 i 17) dla danych, których administratorem jest Ostoja: zapytania i szkice.
-- Zlecenia prowadzi zakład (administrator) – narzędzie tylko wskazuje, do którego zakładu przekazać wniosek.
begin;
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  begin
    perform * from admin_subject_lookup('500100201');
    raise exception 'FAIL: zakład szuka danych osób';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
do $$
declare v jsonb;
begin
  begin
    perform * from admin_subject_lookup('12345');
    raise exception 'FAIL: wyszukanie po fragmencie numeru';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- Ten sam numer w różnym zapisie.
  assert (select count(*) from admin_subject_lookup('+48 500-100-201') where kind = 'zapytanie') = 1, 'brak zapytania';
  assert (select count(*) from admin_subject_lookup('500100201') where kind = 'zlecenie' and home_name = 'Dom Pogrzebowy Cisza') = 1,
    'brak wskazania zakładu ze zleceniem';

  v := admin_subject_export('500 100 201');
  assert v->'zapytania'->0->>'imie_i_nazwisko' = 'Piotr Nowak', 'eksport bez danych zapytania';
  assert v->'zlecenia_u_zakladow'->0->>'zaklad' = 'Dom Pogrzebowy Cisza', 'eksport bez wskazania zakładu';
  assert v->'zlecenia_u_zakladow'->0->>'imie_zmarlego' is null, 'eksport wydaje dane zlecenia zakładu';

  assert admin_subject_erase('500100201') = 1, 'usunięcie danych z zapytania';
  assert (select count(*) from admin_subject_lookup('500100201') where kind = 'zapytanie') = 0, 'dane zapytania zostały';
end $$;

reset role;
do $$ begin
  assert (select principal_name from orders where principal_phone = '+48 500 100 201') = 'Piotr Nowak', 'usunięto dane zakładu';
  assert (select count(*) from admin_audit where action like 'wniosek RODO%') = 5, 'dziennik wniosków (3 wyszukania, eksport, usunięcie)';
  assert not exists (select 1 from admin_audit where target ~ '500\s?100\s?201|100201'), 'pełny numer w dzienniku';
end $$;

rollback;
