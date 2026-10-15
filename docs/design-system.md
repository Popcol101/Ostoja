# System wizualny Ostoi

Podgląd na żywo: `/styleguide`. Tokeny: `src/app/globals.css` (`@theme`). Komponenty: `src/components/ui.tsx`.

## Zasady
- Spokój zamiast sprzedaży: dużo światła, jeden kolor główny, żadnych gradientów, cieni ani emoji.
- Najpierw telefon (390 px). Cele dotyku min. 44 px (`min-h-11`), pola formularzy 48 px.
- Kolor nigdy nie jest jedynym nośnikiem znaczenia – zawsze tekst obok (np. „Wstępny”, „Dopłata ponad zasiłek”).
- Kontrast min. 4,5:1. Tekst ostrzeżeń `warn-ink` (#7A5214) na `warn-tint`, nigdy `warn` na białym tle w tekście.
- Zaokrąglenia: 10 px (przyciski, pola), 12–16 px (karty, komunikaty).

## Kolory
| Token | Hex | Użycie |
| --- | --- | --- |
| ground | #EEF0EC | tło panelu |
| ground-family | #F3F4F1 | tło strony dla rodzin |
| card | #FFFFFF | karty |
| line | #D9DDD6 | obramowania |
| ink / muted | #17211E / #55615C | tekst |
| brand / brand-tint | #24453C / #E3ECE8 | akcje, zaznaczenia |
| warn / warn-ink | #B9802A / #7A5214 | ostrzeżenia (24 h, czas na odpowiedź) |
| night | #17211E | nagłówek panelu |

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
