-- Uprawnienia do kolumn zamiast do całych tabel (przegląd bezpieczeństwa 18.10.2026).
-- 1) Zakład zmieniał w funeral_homes także verified_at, rating i reviews_count – mógł sam się zweryfikować,
--    wrócić na listę ofert po wstrzymaniu i poprawić sobie oceny (a oceny decydują o kolejności ofert).
-- 2) Każdy członek zespołu zmieniał w orders także offer_id, home_id, zgody rodziny i token linku dla rodziny –
--    np. usunięcie offer_id wyjmowało podpisane zlecenie z rozliczeń Ostoi.
-- Zostają tylko kolumny, które panel naprawdę zmienia. Pozostałe zmieniają funkcje security definer
-- (weryfikacja, wstrzymanie, link dla rodziny), które same sprawdzają uprawnienia.

revoke update on public.funeral_homes from authenticated;
grant update (phone, email, address, description, service_radius_km, has_farewell_hall, accepting_today)
  on public.funeral_homes to authenticated;

revoke insert, update on public.orders from authenticated;
grant update (stage, deceased_first_name, deceased_last_name, born_on, died_at, notes, contract_signed_at,
              memorial_slug, memorial_published, memorial_note)
  on public.orders to authenticated;
