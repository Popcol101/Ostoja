# Stan prac – Ostoja (15 października 2026)

## Zrobione

**Baza danych (segment 3, część bazodanowa) – przetestowana.**

| Plik | Zawartość |
| --- | --- |
| supabase/migrations/20261015000100_schema.sql | Tabele: miasta, standard cennika, zakłady, członkostwa, cenniki, zapytania, oferty, zlecenia, zadania, zasoby, wydarzenia, rezerwacje, dyżury |
| supabase/migrations/20261015000200_security.sql | RLS na każdej tabeli, uprawnienia ról anon i authenticated |
| supabase/migrations/20261015000300_functions.sql | Wycena (quote_for), wyszukiwarka dla rodzin (search_homes), rozsyłanie (dispatch_offers), create_inquiry, expire_offers, get_inbox, accept_offer, decline_offer, link dla rodziny (family_get_order, family_update_order), strona pamięci (public_memorial), triggery rezerwacji i umowy, widoki calendar_events i billing_lines |
| supabase/migrations/20261015000400_cron.sql | Wygasanie ofert co minutę przez pg_cron (gdy dostępny) |
| supabase/seed.sql | 6 zakładów (5 zweryfikowanych), 5 użytkowników, cenniki, 5 zapytań, 5 zleceń Domu Pogrzebowego Cisza, tydzień w kalendarzu, dyżury |
| tests/db/*.sql | Testy: izolacja zakładów, prywatność kontaktu rodziny, przepływ zapytania z wygasaniem i przekazaniem dalej, kolizje karawanu, reguła 24 h, link dla rodziny, umowa, rozliczenia, wyszukiwarka |

Wynik: `./tests/db/run.sh` → 3/3 OK.

### Konta testowe (tryb demo)

| E-mail | Zakład | Rola |
| --- | --- | --- |
| anna@cisza.test | Dom Pogrzebowy Cisza | właściciel |
| ewa@cisza.test | Dom Pogrzebowy Cisza | biuro |
| adam@cisza.test | Dom Pogrzebowy Cisza | ekipa |
| piotr@podlipami.test | Usługi Pogrzebowe Pod Lipami | właściciel |
| kasia@kalina.test | Zakład Pogrzebowy Kalina | właściciel |

Linki dla rodzin: /r/demo-rodzina-mazur-0000000000000000000000000000 (przed umową),
/r/demo-rodzina-nowak-0000000000000000000000000000 (po umowie). Strona pamięci: /pamiec/halina-nowak.

## Blokada w poprzedniej sesji
Brak dostępu do rejestru npm – nie dało się zainstalować Next.js. Aplikacja nie jest jeszcze napisana.

## Następne kroki (w tej kolejności)
1. Uruchom lokalny PostgreSQL 16 na porcie 54322 (instrukcja w README.md) i `./tests/db/run.sh`.
2. Szkielet Next.js 15 + Tailwind w tym repozytorium (nie nadpisuj supabase/, tests/, docs/).
3. `src/lib/db.ts`: postgres.js, `withUser(userId, fn)` i `asAnon(fn)` (set local role + request.jwt.claims).
4. Logowanie demo: `/logowanie` z listą kont testowych, podpisane ciasteczko sesji (jose), DEMO_MODE=true.
5. System wizualny i `/styleguide` (segment 2 dokumentu z promptami).
6. Panel: skrzynka zapytań (get_inbox, accept_offer, decline_offer), zlecenia, karta zlecenia,
   kalendarz (calendar_events, bookings), dokumenty (klepsydra PDF, kosztorys, dane do ZUS),
   profil i cennik, rozliczenia (billing_lines).
7. Strona dla rodzin: /, /zapytanie (kreator), /oferty (search_homes), /r/[token], /pamiec/[slug].
8. Vitest dla logiki TS, Playwright: pełny przepływ + zrzuty 390 i 1280 px.

Wzór wyglądu: prototypy „Ostoja – prototypy strony i aplikacji” (zrzuty do docs/prototypy/).
