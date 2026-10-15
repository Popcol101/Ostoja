-- Izolacja zakładów (RLS) i prywatność danych kontaktowych rodzin.
begin;

-- Anna (Dom Pogrzebowy Cisza) widzi tylko swoje dane.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from orders) = 5, 'Cisza powinna widzieć 5 zleceń';
  assert (select count(*) from orders where home_id <> '00000000-0000-4000-a000-000000000001') = 0, 'widać cudze zlecenia';
  assert (select count(*) from funeral_homes) = 1, 'zakład widzi tylko swój profil';
  assert (select count(*) from resources) = 3, 'Cisza ma 3 zasoby';
end $$;

-- Zapytania (z telefonem rodziny) są niedostępne bezpośrednio.
do $$ begin
  perform * from inquiries;
  raise exception 'FAIL: zakład odczytał tabelę inquiries';
exception when insufficient_privilege then null;
end $$;

-- Skrzynka nie zawiera danych kontaktowych, ale zawiera nowe zapytanie.
do $$
begin
  assert exists (select 1 from get_inbox() where status = 'nowe'), 'brak nowego zapytania w skrzynce';
  assert not exists (
    select 1 from information_schema.routines r
    join information_schema.parameters p on p.specific_name = r.specific_name
    where r.routine_name = 'get_inbox' and p.parameter_name in ('contact_phone', 'contact_name')
  ), 'skrzynka zwraca dane kontaktowe';
end $$;

reset role;

-- Piotr (Pod Lipami) nie widzi niczego z Ciszy i nie może tam pisać.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from orders) = 0, 'Pod Lipami widzi cudze zlecenia';
  assert (select count(*) from calendar_events) = 0, 'Pod Lipami widzi cudzy kalendarz';
  assert (select count(*) from bookings) = 0, 'Pod Lipami widzi cudze rezerwacje';
  assert (select count(*) from billing_lines) = 0, 'Pod Lipami widzi cudze rozliczenia';
end $$;

do $$ begin
  update orders set notes = 'włamanie' where home_id = '00000000-0000-4000-a000-000000000001';
  assert not found, 'Pod Lipami zmienił zlecenie Ciszy';
end $$;

do $$ begin
  insert into orders (home_id, burial, ceremony, principal_name, principal_phone)
  values ('00000000-0000-4000-a000-000000000001', 'kremacja', 'bez', 'X', '+48 500 000 000');
  raise exception 'FAIL: wstawiono zlecenie do cudzego zakładu';
exception when insufficient_privilege then null;
end $$;

reset role;

-- Gość bez logowania nie ma dostępu do tabel.
set local role anon;
do $$ begin
  perform * from orders;
  raise exception 'FAIL: anon odczytał zlecenia';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  assert (select count(*) from cities) = 5, 'anon powinien widzieć słownik miast';
end $$;

rollback;
