# Stan prac – Ostoja (15 października 2026, koniec dnia)

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

**Aplikacja (segmenty 2–6) – działa i jest przetestowana.**

| Obszar | Pliki | Stan |
| --- | --- | --- |
| System wizualny | src/app/globals.css, src/components/ui.tsx, client.tsx, /styleguide, docs/design-system.md | gotowe |
| Logowanie demo | /logowanie, src/lib/session.ts (jose, ciasteczko httpOnly) | gotowe; Supabase Auth – do zrobienia |
| Skrzynka zapytań | /panel/zapytania (get_inbox, accept_offer, decline_offer, licznik 15 min) | gotowe |
| Zlecenia | /panel/zlecenia, karta zlecenia: kontakt, link dla rodziny, dane, terminy, umowa, koszt vs zasiłek, zadania, dokumenty, strona pamięci, etap | gotowe |
| Dokumenty | klepsydra (A4, wersja religijna i świecka), kosztorys – druk do PDF z przeglądarki | gotowe |
| Kalendarz | /panel/kalendarz: tydzień, dyżur, ostrzeżenie 24 h, do potwierdzenia, wpis ręczny, eksport .ics | gotowe |
| Profil i cennik | /panel/profil, podgląd „Tak widzą to rodziny” | gotowe |
| Rozliczenia | /panel/rozliczenia (billing_lines) | gotowe |
| Strona dla rodzin | /, /zapytanie (kreator działa też bez JS), /oferty (sortowanie: odległość, cena, oceny), /oferty/kontakt, /zapytanie/wyslane, /r/[token], /pamiec/[slug] | gotowe |

Testy: `npm test` (14 testów Vitest), `npm run test:db` (3/3), `npm run e2e` (6/6: pełny przepływ
rodzina → zakład → umowa → klepsydra, link rodziny, strona pamięci, ochrona panelu; telefon 390 px i komputer 1280 px).
Zrzuty: docs/zrzuty/ (telefon-*.png, komputer-*.png).

### Decyzje i znane ograniczenia
- Komunikaty po akcjach: w adresie tylko kod (`?ok=umowa-podpisana`), teksty w src/lib/messages.ts – nikt nie podrzuci
  rodzinie fałszywego komunikatu linkiem.
- Bez `loading.tsx`: w Next.js 15.5 granica ładowania gubi przekierowanie po akcji serwerowej (wykryte w E2E).
  Stan ładowania: SubmitButton i znacznik w menu panelu (useLinkStatus). Wrócić po aktualizacji Next.js.
- Limit zapytań od rodzin (5/h na IP) trzymany w pamięci procesu – na produkcji przenieść do bazy lub Redis.
- Brak SMS i powiadomień push: link dla rodziny zakład wysyła przyciskiem „Wyślij SMS-em” (aplikacja SMS w telefonie).
- Dokumenty PDF przez druk w przeglądarce zamiast @react-pdf/renderer (prościej, polskie znaki bez osadzania fontów).
- Wygasanie ofert: pg_cron na Supabase; lokalnie przy każdym odczycie skrzynki.

## Następne kroki (w tej kolejności)
1. Przejść kryteria akceptacji z docs/zakres-panelu-v1.md z 1–2 zakładami na zrzutach i wersji testowej.
2. Supabase Auth (link magiczny) zamiast logowania demo; zaproszenia pracowników.
3. Powiadomienia: web-push dla nowego zapytania, SMS (SMSAPI) z linkiem dla rodziny i weryfikacją numeru.
4. Wdrożenie: projekt Supabase (Frankfurt) + Vercel (region fra1), zmienne środowiskowe, DEMO_MODE=false na produkcji.
5. Przegląd bezpieczeństwa i RODO przed prawdziwymi danymi (umowa powierzenia z zakładami, rejestr czynności).
