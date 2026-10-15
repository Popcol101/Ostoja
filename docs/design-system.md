# System wizualny Ostoi

Podgląd na żywo: `/styleguide`. Tokeny: `src/app/globals.css` (`@theme`). Komponenty: `src/components/ui.tsx`.

## Zasady
- Spokój zamiast sprzedaży: dużo światła, jeden kolor główny, żadnych gradientów, cieni ani emoji.
- Najpierw telefon (390 px). Cele dotyku min. 44 px (`min-h-11`), pola formularzy 48 px.
- Kolor nigdy nie jest jedynym nośnikiem znaczenia – zawsze tekst obok (np. „Wstępny”, „Dopłata ponad zasiłek”).
- Kontrast min. 4,5:1. Tekst ostrzeżeń `warn-ink` (#6E5A33) na `warn-tint`, nigdy `warn` (piasek) jako kolor tekstu.
- Zaokrąglenia: 10 px (przyciski, pola), 12–16 px (karty, komunikaty).

## Kolory
Pełna paleta z nazwami i proporcjami: docs/identyfikacja-wizualna.md.

| Token | Hex | Użycie |
| --- | --- | --- |
| ground | #ECEDEB | tło panelu |
| ground-family | #F4F4F2 | tło strony dla rodzin |
| card | #FFFFFF | karty |
| line / line-soft | #D8DAD7 / #E5E7E4 | obramowania, podziały |
| field | #878E8A | obramowanie pól formularzy (3:1 na białym) |
| ink / muted | #1E2422 / #5C6461 | tekst |
| brand / brand-dark / brand-tint | #3F5650 / #2F423D / #E6EAE8 | akcje, zaznaczenia |
| sand / sand-light | #A68B5B / #CDB98F | linia drogi w znaku, akcent; jasny – na ciemnym tle |
| warn / warn-ink / warn-tint | #A68B5B / #6E5A33 / #F1ECE2 | ostrzeżenia (24 h, czas na odpowiedź) |
| danger / danger-tint | #8E3B33 / #F3E6E3 | błędy |
| night / night-raised / night-text | #1E2422 / #2A3230 / #C9CECB | nagłówek panelu |

## Typografia
Newsreader – nagłówki (30–52 px). Figtree – interfejs (16 px tekst, 17 px półgruby tytuł karty, 14 px podpisy).

## Komponenty
Button (primary, secondary, quiet, danger), LinkButton, Card + CardTitle, Badge (brand, warn, neutral, danger, night),
Notice (brand, warn, danger – z rolą status/alert), Field + Input/Select/Textarea, EmptyState, PageTitle, DefinitionList.
Interaktywne (`src/components/client.tsx`): Countdown, CopyButton, OfflineBanner, SubmitButton, PrintButton.

## Stany ekranu
Każdy ekran: pusty (EmptyState), ładowanie, błąd (`error.tsx`), offline (OfflineBanner w nagłówku).

Ładowanie: przyciski formularzy pokazują stan zapisu (SubmitButton, „Zapisuję…”), a pozycje menu panelu
znacznik „Wczytuję…” (`useLinkStatus`). **Nie używamy `loading.tsx`** w segmentach z akcjami serwerowymi:
w Next.js 15.5 granica ładowania sprawia, że router gubi przekierowanie po akcji (formularz zapisuje się,
ale ekran się nie odświeża). Wykryte testem E2E; wrócić do tematu po aktualizacji Next.js.

Komunikaty po akcjach: w adresie tylko kod (`?ok=umowa-podpisana`), teksty w `src/lib/messages.ts`.
