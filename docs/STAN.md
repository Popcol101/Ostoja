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
   - Supabase (projekt iarvcirfxjlyxpicnxyr, Frankfurt): wszystkie migracje do 800 i dane testowe wgrane (6 zakładów).
     Doradca bezpieczeństwa: zostały tylko uwagi zamierzone (funkcje strony dla rodzin dla anon, funkcje panelu dla
     authenticated – każda sprawdza auth.uid()) i „RLS bez polityk” dla tabel dostępnych wyłącznie przez funkcje.
   - Vercel: konektor nie ma dostępu do zespołu „ostoja”, więc projekt zakłada się ręcznie (vercel.com/new → import
     Popcol101/Ostoja → wklejenie zmiennych). Bez DATABASE_URL build się nie uda (src/lib/db.ts).
   - Po pierwszym wdrożeniu: poprawić APP_URL i VAPID_SUBJECT na faktyczny adres, uruchomić
     scripts/supabase/harmonogram-powiadomien.sql (ten sam CRON_SECRET), w Supabase Auth wyłączyć rejestrację,
     ustawić Site URL i Redirect URLs na adres aplikacji.
2. Przejść scenariusze z arkusza z 1–2 zakładami; uwagi do zakładki Spotkania, błędy do zakładki Błędy.
3. Przegląd prawny: docs/prawne/Ostoja-RODO-i-bezpieczenstwo-szkic.docx, /prywatnosc, /regulamin; umowy DPA z dostawcami.
4. Do dopracowania: uzasadnienie przy wstrzymaniu zakładu (P2B), procedura naruszeń i realizacji praw osób,
   monitoring błędów bez danych osobowych, pełna CSP dla skryptów.
5. Produkcja: DEMO_MODE=false, ALLOW_INDEXING=true, SMSAPI_TEST=false, plany Supabase Pro i Vercel Pro.
