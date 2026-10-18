-- Zakład zmienia tylko to, co pokazuje panel. Weryfikacja, oceny i rozliczenia są poza jego zasięgiem.
begin;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Profil: dozwolone pola działają.
update funeral_homes set phone = '+48 600 000 009', accepting_today = accepting_today
where id = '00000000-0000-4000-a000-000000000001';

-- Weryfikacja i oceny: brak uprawnień.
do $$ begin
  begin
    update funeral_homes set verified_at = now() where id = '00000000-0000-4000-a000-000000000001';
    assert false, 'zakład zmienił verified_at';
  exception when insufficient_privilege then null; end;
  begin
    update funeral_homes set rating = 5, reviews_count = 999 where id = '00000000-0000-4000-a000-000000000001';
    assert false, 'zakład zmienił swoje oceny';
  exception when insufficient_privilege then null; end;
  begin
    update funeral_homes set nip = '0000000000' where id = '00000000-0000-4000-a000-000000000001';
    assert false, 'zakład zmienił NIP';
  exception when insufficient_privilege then null; end;
end $$;

-- Zlecenie: pola z panelu działają.
update orders set notes = null, stage = stage where home_id = '00000000-0000-4000-a000-000000000001';

-- Rozliczenia, zgody rodziny i link dla rodziny: brak uprawnień, także dla ekipy.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ begin
  begin
    update orders set offer_id = null where home_id = '00000000-0000-4000-a000-000000000001';
    assert false, 'członek zespołu wyjął zlecenie z rozliczeń (offer_id)';
  exception when insufficient_privilege then null; end;
  begin
    update orders set family_consents = '{"dane_do_dokumentow":true}' where home_id = '00000000-0000-4000-a000-000000000001';
    assert false, 'zakład zmienił zgody rodziny';
  exception when insufficient_privilege then null; end;
  begin
    update orders set family_token_until = now() + interval '10 years' where home_id = '00000000-0000-4000-a000-000000000001';
    assert false, 'zakład przedłużył link dla rodziny';
  exception when insufficient_privilege then null; end;
  begin
    update orders set principal_phone = '+48 111 111 111' where home_id = '00000000-0000-4000-a000-000000000001';
    assert false, 'zakład podmienił telefon rodziny w zleceniu';
  exception when insufficient_privilege then null; end;
  begin
    insert into orders (home_id, burial, ceremony, principal_name, principal_phone)
    values ('00000000-0000-4000-a000-000000000001', 'tradycyjny', 'bez', 'Ktoś', '+48 500 000 000');
    assert false, 'zakład dodał zlecenie z pominięciem zapytania';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
-- Funkcje administracji nadal działają (właściciel tabeli).
do $$ begin
  assert has_column_privilege('authenticated', 'public.funeral_homes', 'verified_at', 'UPDATE') = false;
  assert has_column_privilege('authenticated', 'public.orders', 'offer_id', 'UPDATE') = false;
  assert has_column_privilege('authenticated', 'public.orders', 'notes', 'UPDATE');
end $$;

rollback;
