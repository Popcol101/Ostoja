# Ostoja – panel partnera i strona dla rodzin

## Czym jest projekt
Ostoja łączy rodziny organizujące pogrzeb z zakładami pogrzebowymi.
Budujemy DZIAŁAJĄCĄ aplikację: panel dla zakładu pogrzebowego i stronę dla rodzin,
z prawdziwą bazą, logowaniem i przepływem zapytań. Testujemy ją z 5 zakładami.
Stan prac i następne kroki: docs/STAN.md (czytaj na początku każdej sesji).
Zakres i bolączki: docs/zakres-panelu-v1.md (do dodania z dokumentu „Ostoja – panel partnera v1”).

## Użytkownicy
- Zakład: właściciel lub pracownik małej firmy (1–10 osób), często 50+, telefon w terenie,
  komputer w biurze, praca pod presją czasu i w nocy.
- Rodzina: osoba w żałobie, na telefonie, bez konta i bez logowania.

## Stack
- Next.js (App Router, Server Actions) + TypeScript (strict) + Tailwind CSS + lucide-react.
- Baza: PostgreSQL w Supabase (region Frankfurt). Migracje: supabase/migrations/.
- Dostęp do bazy z serwera Next.js: sterownik `postgres` (postgres.js), połączenie bezpośrednie.
  Każde zapytanie w imieniu użytkownika idzie przez `withUser(userId, fn)`, które w transakcji ustawia
  `set local role authenticated` i `request.jwt.claims` — dokładnie jak Supabase, więc RLS działa.
  Strona dla rodzin używa roli `anon` i wyłącznie funkcji security definer (create_inquiry, search_homes,
  family_get_order, family_update_order, public_memorial).
- Logowanie w prototypie: tryb demo (wybór konta testowego, tylko gdy DEMO_MODE=true).
  Docelowo: Supabase Auth (link magiczny), ten sam `auth.users`.
- Walidacja: zod. PDF: @react-pdf/renderer. Push: web-push. SMS: SMSAPI. iCal: ical-generator.
- Testy: tests/db/run.sh (SQL, RLS i logika bazy), Vitest (logika TS), Playwright (E2E).

## Baza lokalnie (bez Dockera)
- PostgreSQL 16 na porcie 54322. `supabase/local/00_supabase_shim.sql` odtwarza schemat `auth`,
  role i `auth.uid()` — TYLKO lokalnie, nigdy na projekcie Supabase.
- `./scripts/db-reset.sh` — baza `ostoja` od zera (nakładka + migracje + seed).
- `./tests/db/run.sh` — testy bazy na osobnej bazie `ostoja_test`.
- Z Dockerem możesz zamiast tego używać `npx supabase start` / `db reset` / `test db`.

## Wygląd (nadrzędny wobec wszystkich skilli)
Pełna księga znaku: docs/identyfikacja-wizualna.md. Pliki logo: public/brand/ (generuje scripts/brand/build_logo.py).
Paleta stonowana (zieleń i piasek złamane szarością): tło #ECEDEB (panel) / #F4F4F2 (rodziny), karty #FFFFFF
z obramowaniem #D8DAD7, nagłówek panelu #1E2422. Kolor główny #3F5650, jasny akcent #E6EAE8,
piasek #A68B5B (akcent, ostrzeżenia; tekst ostrzeżeń #6E5A33), tekst #1E2422 i #5C6461.
Znak: dwie bramy jedna za drugą i prosta linia drogi w osi (do 24 px bez wewnętrznej bramy) – nie zmieniaj proporcji, nie dodawaj elementów.
Fonty: Newsreader (nagłówki), Figtree (interfejs). Zaokrąglenia 10–16 px.
Bez emoji, gradientów, cieni i „kart z kolorowym lewym brzegiem”.

## Zasady bezwzględne
- Cały interfejs po polsku; słownik i ton wg skilla ostoja-styl-i-ton.
- Najpierw telefon (390 px), potem komputer (1280 px). Przyciski min. 44 px.
- Dostępność: prawdziwe <button>, <a>, <label>; kontrast min. 4,5:1; kolor nigdy jedynym nośnikiem znaczenia.
- Każdy ekran ma stany: pusty, ładowanie, błąd, offline.
- Nie zbieramy przyczyny zgonu. Telefon rodziny zakład widzi dopiero po przyjęciu zapytania (accept_offer).
- Pochówek nie wcześniej niż 24 h od zgonu – kalendarz ostrzega (widok calendar_events.warning), nie blokuje.
- Kolejności ofert nie da się kupić; sortowanie tylko po odległości, cenie, ocenach.
- Klucze tylko w zmiennych środowiskowych; połączenie z rolą postgres/service tylko po stronie serwera.
- Logi bez PESEL, telefonów i nazwisk.
- Do odwołania tylko dane testowe; prawdziwe dane po przeglądzie bezpieczeństwa i RODO.

## Sposób pracy
- Przed kodem: plan i pytania, gdy coś jest niejasne. Nie zgaduj wymagań.
- Zmiany w bazie wyłącznie nowymi migracjami; po zmianie: ./tests/db/run.sh.
- Logika serwerowa test-first; każda akcja serwerowa: zod + sprawdzenie uprawnień + test.
- Małe kroki, commit po każdym zadaniu.
- Zadanie jest skończone, gdy testy przechodzą, są zrzuty 390 i 1280 px i kryteria akceptacji są sprawdzone.
- Pierwszeństwo skilli przy sprzeczności: ostoja-styl-i-ton > ten plik > ui-ux-pro-max > frontend-design.
