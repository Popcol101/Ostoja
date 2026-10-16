# Stan prac – Ostoja (16 października 2026)

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
| Logowanie linkiem z e-maila | src/lib/auth.ts, /logowanie, /logowanie/potwierdz | gotowe (Supabase Auth); konta testowe tylko @….test |
| Powiadomienia | migracja 20261016000100, src/lib/notify.ts, public/sw.js, /api/powiadomienia | push o nowym zapytaniu, SMS z linkiem dla rodziny |
| Role w zakładzie | migracja 20261016000200 | profil i cennik zmienia tylko właściciel i biuro |
| Zespół zakładu | migracja 20261016000300, /panel/zespol, /zaproszenie | zaproszenia linkiem (7 dni, raz), odbieranie dostępu |
| Panel administratora | migracja 20261016000400, /admin | ręczne dodawanie partnerów, zaproszenie właściciela, weryfikacja i wstrzymanie, zapytania do opiekuna, rozliczenia, dziennik działań |
| Kod SMS dla rodziny | migracja 20261016000500, /oferty/potwierdz, src/lib/phone.ts | zapytanie trafia do zakładów dopiero po kodzie; w wersji testowej kod na ekranie |
| Bezpieczeństwo | migracja 20261016000600, next.config.ts, src/lib/rate-limit.ts | funkcje z sekretami tylko dla serwera, limity w bazie, CSP, retencja danych |
| Strony prawne | /prywatnosc, /regulamin | wersja robocza do przeglądu prawnego |
| Dokumenty | docs/poradnik/ (poradnik + arkusz scenariuszy), docs/prawne/ (RODO i bezpieczeństwo, szkic) | gotowe |
| Wersja testowa | .github/workflows/, vercel.json, scripts/staging-reset.sh | CI, migracje i reset danych z GitHuba, noindex |

Testy: `npm test` (27 testów Vitest), `npm run test:db` (9/9), `npm run e2e` (24/24: przepływ rodzina → kod SMS → zakład →
umowa → klepsydra, link rodziny, strona pamięci, logowanie linkiem, powiadomienia, zespół, administracja, strony prawne;
telefon 390 px i komputer 1280 px). Zrzuty: docs/zrzuty/.

**16 października:**

| Obszar | Pliki | Stan |
| --- | --- | --- |
| Wstrzymanie zakładu (P2B) | migracja 20261016000900, /admin/zaklady/[id], /admin/odwolania, /panel/status, /regulamin-partnera | podstawa + opis faktów, baner i uzasadnienie w panelu (z wydrukiem), odwołanie (właściciel/biuro), odpowiedź z uzasadnieniem, historia statusu |
| Monitoring błędów | migracja 20261016001000, src/instrumentation.ts, /api/bledy, /admin/bledy | błędy serwera i przeglądarki bez danych osobowych, grupowane, 30 dni |
| CSP z nonce | src/middleware.ts, src/app/layout.tsx | skrypty tylko z nonce ('strict-dynamic'); wszystkie strony renderowane dynamicznie |
| Wnioski RODO | migracja 20261016001100, /admin/rodo | wyszukanie po numerze, kopia danych JSON, usunięcie z zapytań; zlecenia – wskazanie zakładu |
| Procedury | docs/prawne/ (rozdział 10) | naruszenia (72 h) i wnioski osób – do zatwierdzenia |
| E-maile logowania | docs/supabase-szablony-email.md | szablon Magic Link po polsku; potrzebny własny SMTP |
| Klepsydry | migracja 20261016001200, src/lib/obituary.ts (+ test), /panel/zlecenia/[id]/klepsydra, /klepsydra/[adres] | treść wg polskiego zwyczaju: religijna (krzyż, Ś.P., sakramenty, Msza Święta żałobna), świecka (bez symboli religijnych, opcjonalnie gałązka), bez ceremonii / w gronie najbliższych; odmiana zmarła/zmarł, kremacja (urna), dzień tygodnia; podgląd na żywo, druk A4 (1 strona, dopasowanie treści); publikacja za zgodą rodziny, adres z losową końcówką, 30 dni po pogrzebie znika; udostępnianie: Facebook, WhatsApp, SMS, e-mail, kopiowanie, systemowe „Udostępnij”; obraz podglądu linku 1200×630 |
| Komunikaty | src/lib/messages.ts + test | test pilnuje, że każdy błąd z bazy ma tekst dla użytkownika (znalazł 2 brakujące) |

Testy: `npm test` (48), `npm run test:db` (13/13), `npm run e2e` (40/40 na 390 i 1280 px).

Konto administratora testowego: ola@ostoja.test (Ola Maj) – na /logowanie, panel /admin.

### Decyzje i znane ograniczenia
- Komunikaty po akcjach: w adresie tylko kod (`?ok=umowa-podpisana`), teksty w src/lib/messages.ts.
- Bez `loading.tsx`: w Next.js 15.5 granica ładowania gubi przekierowanie po akcji serwerowej (wykryte w E2E).
- Dokumenty PDF przez druk w przeglądarce zamiast @react-pdf/renderer.
- Funkcje bazy zwracające sekrety (kod SMS, e-mail z zaproszenia) wywołuje tylko serwer (`asServer`, rola service_role);
  test 09_hardening pilnuje, by rola anon miała dostęp tylko do funkcji strony dla rodzin.
- Harmonogram (pg_cron na Supabase): wysyłka powiadomień co minutę i retencja danych codziennie –
  scripts/supabase/harmonogram-powiadomien.sql.

## Następne kroki (w tej kolejności)
1. Wersja testowa – stan:
   - Supabase (projekt iarvcirfxjlyxpicnxyr, Frankfurt): migracje do 1200 (klepsydry) wgrane konektorem, z wyjątkiem dwóch funkcji
     z „delete” (purge_old_data w nowej wersji, admin_subject_erase) – **do uruchomienia przez właściciela:
     scripts/supabase/uzupelnienie-2026-10-16.sql w SQL Editor** (przenosi też pg_net do schematu extensions).
     Do tego czasu przycisk „Usuń dane z zapytań” w /admin/rodo zwraca błąd, a retencja nie czyści błędów aplikacji.
     Konektor Supabase anuluje migracje z instrukcją delete/drop – takie zmiany zawsze przez SQL Editor.
   - Doradca bezpieczeństwa: uwagi zamierzone (funkcje rodzin dla anon, funkcje panelu/administracji dla authenticated –
     każda sprawdza auth.uid() lub assert_platform_admin) i „RLS bez polityk” dla tabel dostępnych tylko przez funkcje.
   - Vercel: projekt „ostoja” (zespół ostoja, fra1), połączony z GitHubem, wdraża się po każdym pushu na main.
     Adres: https://ostoja-cyan.vercel.app. Zmienne ustawione; DATABASE_URL i SUPABASE_SERVICE_ROLE_KEY jako Sensitive.
   - Harmonogram w Supabase (pg_cron + pg_net, sekret w Vault): ostoja-expire-offers, ostoja-powiadomienia (co minutę),
     ostoja-retencja (codziennie 3:15 UTC).
   - Do zrobienia przez właściciela (docs/supabase-szablony-email.md): wyłączyć rejestrację, Site URL i Redirect URLs,
     szablon Magic Link, **własny SMTP** (wbudowana poczta Supabase wysyła tylko do członków zespołu projektu).
2. Przejść scenariusze z arkusza z 1–2 zakładami; uwagi do zakładki Spotkania, błędy do zakładki Błędy.
   Nowe scenariusze do arkusza: wstrzymanie i odwołanie, wniosek RODO, podgląd błędów, klepsydra (edycja, druk, publikacja,
   udostępnienie). Zapytać zakłady: czy dodać zdjęcie zmarłego na klepsydrze (wymaga przechowywania plików i zgody rodziny).
3. Przegląd prawny: docs/prawne/Ostoja-RODO-i-bezpieczenstwo-szkic.docx (z rozdziałem 10), /prywatnosc, /regulamin,
   /regulamin-partnera (mediatorzy do wskazania); umowy DPA z dostawcami.
4. Do dopracowania: e-mail do zakładu przy wstrzymaniu (trwały nośnik), alerty o nowych błędach, kopie zapasowe (Supabase Pro),
   test penetracyjny przed produkcją.
5. Produkcja: DEMO_MODE=false, ALLOW_INDEXING=true, SMSAPI_TEST=false, plany Supabase Pro i Vercel Pro (Hobby nie pozwala
   na użytek komercyjny).
