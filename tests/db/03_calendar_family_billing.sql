-- Kalendarz (kolizje, reguła 24 h), link dla rodziny, umowa i rozliczenia.
begin;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Karawan 1 jest zajęty na odbiorze dziś 14:00–15:00: druga rezerwacja w tym czasie nie przejdzie.
insert into events (id, home_id, kind, title, during)
select '00000000-0000-4000-f000-0000000000aa', '00000000-0000-4000-a000-000000000001', 'spotkanie', 'Test kolizji', during
from events where id = '00000000-0000-4000-f000-000000000001';
do $$ begin
  insert into bookings (event_id, resource_id, home_id, during)
  values ('00000000-0000-4000-f000-0000000000aa', '00000000-0000-4000-b000-000000000001',
          '00000000-0000-4000-a000-000000000001', '[,]');
  raise exception 'FAIL: karawan zarezerwowany dwa razy naraz';
exception when exclusion_violation then null;
end $$;

-- Po odwołaniu pierwszego wydarzenia karawan się zwalnia.
update events set status = 'odwolany' where id = '00000000-0000-4000-f000-000000000001';
insert into bookings (event_id, resource_id, home_id, during)
values ('00000000-0000-4000-f000-0000000000aa', '00000000-0000-4000-b000-000000000001',
        '00000000-0000-4000-a000-000000000001', '[,]');
do $$ begin
  assert (select count(*) from bookings where event_id = '00000000-0000-4000-f000-000000000001') = 0, 'odwołane wydarzenie trzyma rezerwację';
  assert (select count(*) from bookings where event_id = '00000000-0000-4000-f000-0000000000aa') = 1, 'brak nowej rezerwacji';
end $$;

-- Przesunięcie wydarzenia przesuwa rezerwację i nadal pilnuje kolizji.
do $$ begin
  update events set during = (select during from events where id = '00000000-0000-4000-f000-000000000007')
  where id = '00000000-0000-4000-f000-0000000000aa';
  raise exception 'FAIL: przesunięcie na zajęty karawan przeszło';
exception when exclusion_violation then null;
end $$;

-- Reguła 24 godzin: ostrzeżenie tylko dla zbyt wczesnego pochówku.
do $$ begin
  assert (select warning from calendar_events where id = '00000000-0000-4000-f000-000000000008') is not null, 'brak ostrzeżenia 24 h';
  assert (select warning from calendar_events where id = '00000000-0000-4000-f000-000000000005') is null, 'fałszywe ostrzeżenie 24 h';
end $$;

-- Umowa: etap zmienia się automatycznie, a podpisanej umowy nie da się cofnąć.
update orders set contract_signed_at = now() where id = '00000000-0000-4000-d000-000000000002';
do $$ begin
  assert (select stage from orders where id = '00000000-0000-4000-d000-000000000002') = 'umowa', 'etap nie zmienił się na umowa';
end $$;
do $$ begin
  update orders set contract_signed_at = null where id = '00000000-0000-4000-d000-000000000002';
  raise exception 'FAIL: cofnięto podpisaną umowę';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- Rozliczenia: tylko zlecenia z Ostoi z podpisaną umową (o1, o3, teraz także o2).
do $$ begin
  assert (select count(*) from billing_lines) = 3, 'zła liczba pozycji rozliczenia';
  assert (select sum(fee_net_pln) from billing_lines) = 750, 'zła suma opłat';
end $$;

reset role;

-- Link dla rodziny: bez logowania, tylko dozwolone pola.
set local role anon;
do $$
declare j jsonb;
begin
  j := family_get_order('demo-rodzina-mazur-0000000000000000000000000000');
  assert j->'home'->>'name' = 'Dom Pogrzebowy Cisza', 'rodzina nie widzi nazwy zakładu';
  assert j ? 'price_list', 'brak cennika dla rodziny';
  assert family_get_order('zly-token') is null, 'zły token zwrócił dane';

  j := family_update_order('demo-rodzina-mazur-0000000000000000000000000000',
         '{"deceased_first_name":"Stanisław","zus_bank_account":"12 3456 7890 1234 5678 9012 3456",
           "selected_items":["oprawa_muzyczna"]}');
  assert (j->>'total_pln')::numeric = 5240 + 450, 'suma nie uwzględnia oprawy muzycznej';
  assert j->>'zus_bank_account' = '12345678901234567890123456', 'numer konta nie został zapisany';
end $$;

do $$ begin
  perform family_update_order('demo-rodzina-mazur-0000000000000000000000000000', '{"principal_phone":"+48 999 999 999"}');
  raise exception 'FAIL: rodzina zmieniła niedozwolone pole';
exception when insufficient_privilege then null;
end $$;

-- Po podpisaniu umowy rodzina nie zmieni zakresu usług.
do $$ begin
  perform family_update_order('demo-rodzina-nowak-0000000000000000000000000000', '{"selected_items":["wiazanka"]}');
  raise exception 'FAIL: zmieniono zakres po podpisaniu umowy';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- Strona pamięci: tylko opublikowana.
do $$ begin
  assert public_memorial('halina-nowak')->>'first_name' = 'Halina', 'brak opublikowanej strony pamięci';
  assert public_memorial('nie-istnieje') is null, 'nieistniejąca strona zwróciła dane';
end $$;

-- Wyszukiwarka dla rodzin: tylko zweryfikowane zakłady, ceny w standardzie.
do $$ begin
  assert (select count(*) from search_homes('lodz', 'kremacja', 'swiecka')) = 4, 'Łódź: powinny być 4 zakłady';
  assert (select quote_pln from search_homes('lodz', 'kremacja', 'swiecka') where slug = 'dom-pogrzebowy-cisza') = 5790, 'zła cena Ciszy';
  assert (select slug from search_homes('lodz', 'kremacja', 'swiecka', 'cena') limit 1) = 'zaklad-pogrzebowy-kalina', 'sortowanie po cenie';
  assert not exists (select 1 from search_homes('lodz', 'kremacja', 'swiecka') where slug = 'nowy-zaklad-niezweryfikowany'), 'niezweryfikowany zakład w wynikach';
end $$;

rollback;
