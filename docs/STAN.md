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

**Od wieczoru 15 października także:**

| Obszar | Pliki | Stan |
| --- | --- | --- |
| Identyfikacja wizualna | docs/identyfikacja-wizualna.md, public/brand/, scripts/brand/ | znak „Brama i droga” (dwie bramy i droga), paleta stonowana |
| Logowanie linkiem z e-maila | src/lib/auth.ts, /logowanie, /logowanie/potwierdz | gotowe (Supabase Auth); tryb demo zostaje na wersji testowej |
| Powiadomienia | migracja 20261016000100, src/lib/notify.ts, public/sw.js, /api/powiadomienia | push o nowym zapytaniu, SMS z linkiem dla rodziny (SMSAPI, tryb testowy) |
| Role | migracja 20261016000200 | profil i cennik zmienia tylko właściciel i biuro (RLS + akcje) |
| Wersja testowa | .github/workflows/, vercel.json, scripts/staging-reset.sh, robots | CI, migracje i reset danych z GitHuba, noindex |
| Poradnik | docs/poradnik/ (Word + arkusz scenariuszy, skrypty do odtworzenia) | gotowe |

Testy: `npm test` (25 testów Vitest), `npm run test:db` (5/5), `npm run e2e` (12/12: pełny przepływ
rodzina → zakład → umowa → klepsydra, link rodziny, strona pamięci, ochrona panelu, logowanie linkiem, powiadomienia;
telefon 390 px i komputer 1280 px). Zrzuty: docs/zrzuty/.

### Decyzje i znane ograniczenia
- Komunikaty po akcjach: w adresie tylko kod (`?ok=umowa-podpisana`), teksty w src/lib/messages.ts – nikt nie podrzuci
  rodzinie fałszywego komunikatu linkiem.
- Bez `loading.tsx`: w Next.js 15.5 granica ładowania gubi przekierowanie po akcji serwerowej (wykryte w E2E).
  Stan ładowania: SubmitButton i znacznik w menu panelu (useLinkStatus). Wrócić po aktualizacji Next.js.
- Dokumenty PDF przez druk w przeglądarce zamiast @react-pdf/renderer (prościej, polskie znaki bez osadzania fontów).
- Wygasanie ofert i dosyłanie powiadomień: pg_cron na Supabase (scripts/supabase/harmonogram-powiadomien.sql);
  lokalnie przy każdym odczycie skrzynki.

## Następne kroki (w tej kolejności)
1. Postawić wersję testową według docs/poradnik/Ostoja-poradnik-wersji-testowej.docx (Supabase + Vercel, ok. godziny).
2. Przejść scenariusze z arkusza z 1–2 zakładami; uwagi do zakładki Spotkania, błędy do zakładki Błędy.
3. Zaproszenia pracowników z panelu (dziś konta zakłada się w Supabase i SQL).
4. Weryfikacja numeru rodziny kodem SMS przed wysłaniem zapytania.
5. Przegląd bezpieczeństwa i RODO przed prawdziwymi danymi (umowa powierzenia z zakładami, rejestr czynności),
   potem produkcja z DEMO_MODE=false.
