# Identyfikacja wizualna Ostoi

Pliki znaku:  (generuje , PNG: PNG gotowe). Tokeny w kodzie: . Podgląd komponentów: .

Ostoja łączy rodziny organizujące pogrzeb z zakładami pogrzebowymi. Marka ma dawać to, co obiecuje jej nazwa: oparcie i spokojne miejsce w trudnym tygodniu. Wygląd jest cichy, rzeczowy i ciepły bez czułostkowości. Kolory są złamane szarością, kształty proste, a jedynym wyrazistym elementem jest znak.

## Idea

- **Brama i droga.** Znak to dwie bramy, jedna za drugą, i prosta droga w ich osi. Droga zaczyna się na progu i prowadzi w głąb. To ostatnia droga, którą rodzina przechodzi razem z bliską osobą, i miejsce, w którym ktoś na nią czeka.
- **Trzy cechy:** spokój (dużo światła, mało elementów), jasność (pełne ceny, proste zdania, jedna decyzja na ekran), opieka (zawsze widać, do kogo zadzwonić).
- **Czego unikamy:** czerni i lilii z nekrologów, złota i ornamentów, uśmiechniętych ludzi ze zdjęć stockowych, języka sprzedaży.

## Kolor

Paleta to szałwiowa zieleń i piasek złamane szarością, na tle mgły i kamienia. Proporcje na każdym ekranie i w każdym druku: ok. 70% tła (`ground-family`, `ground`, `card`), 20% tekstu (`ink`, `muted`), 8% szałwii (`brand`, `brand-tint`), najwyżej 2% piasku (`sand`).

| Nazwa | Token | Dzień | Noc | Do czego |
| --- | --- | --- | --- | --- |
| Mgła | `ground-family` | #F4F4F2 | #171C1B | tło strony dla rodzin |
| Kamień | `ground` | #ECEDEB | #171C1B | tło panelu zakładu |
| Biel | `card` | #FFFFFF | #222927 | karty i pola |
| Grafit | `ink` | #1E2422 | #E4E7E5 | tekst główny |
| Popiel | `muted` | #5C6461 | #AEB6B2 | tekst drugorzędny |
| Szałwia | `brand` | #3F5650 | #8FB3A6 | przyciski, linki, łuk znaku |
| Szałwia jasna | `brand-tint` | #E6EAE8 | #2A3431 | zaznaczenie, potwierdzenie |
| Piasek | `sand` | #A68B5B | #CDB98F | linia drogi w znaku, drobne akcenty |
| Piasek ciemny | `warn-ink` | #6E5A33 | #E2CFA6 | tekst ostrzeżeń |
| Cegła | `danger` | #8E3B33 | #E3A59C | błędy |
| Noc | `night` | #1E2422 | #101413 | nagłówek panelu, stopka |

Zasady:

- Przycisk główny: `brand` z tekstem `on-brand`. Na stronę przypada jeden taki przycisk w widoku; pozostałe akcje są drugorzędne (obramowanie `brand`, tło `card`).
- Piasek nie jest kolorem tekstu na jasnym tle (3,2:1). Ostrzeżenia piszemy `warn-ink` na `warn-tint`, a piasek zostaje dla linii drogi, paska licznika i obramowania wstępnego terminu.
- Cegła (`danger`) oznacza tylko błąd lub odwołanie. Nigdy jako dekoracja i nigdy bez słowa obok.
- Biel tylko na kartach i polach. Tło strony to zawsze `ground-family` (rodziny) albo `ground` (panel).
- Kolor nigdy nie niesie znaczenia sam: przy każdym stanie stoi słowo („Wstępny”, „Potwierdzony”, „Dopłata ponad zasiłek”).
- Motyw Noc jest przygotowany na tryb nocnego dyżuru w panelu. Tekst na wypełnieniu `brand` w tym motywie jest ciemny (`on-brand`).

## Typografia

Dwa kroje, oba z Google Fonts (w aplikacji przez `@fontsource-variable`):

- **Newsreader** – nagłówki, imiona na klepsydrze i stronie pamięci, słowa rodziny. Style: `display`, `h1`, `h2`, `memorial`, `quote`. Waga 400–500, nigdy pogrubiony.
- **Figtree** – cały interfejs: `body` (16 px), `card-title` (17 px półgruby), `button` (15 px półgruby), `small` (14 px), `label` (13 px, wersaliki), `price` (28 px półgruby).

Zasady:

- Zdania i tytuły piszemy zwykłą pisownią zdaniową. Wersaliki tylko w stylu `label` (np. „NOWE ZAPYTANIE”), z rozstrzeleniem 0,6 px.
- Kwoty zawsze pełne i z cyframi tabelarycznymi: „5 790 zł” (spacja niełamliwa przed „zł” i w tysiącach). Nigdy „od 4 990 zł”.
- Godziny w zapisie 24-godzinnym („14:00”), daty słownie z małej litery („pt., 16 października”).
- Szerokość kolumny tekstu do `measure` (ok. 65 znaków). Nagłówki z wyrównaniem do lewej, nie wyśrodkowane – wyjątek: klepsydra i strona pamięci.

## Układ i kształt

- Siatka 4 px, odstępy z tokenów `space-*`. Na telefonie margines boczny `space-4` (16 px).
- Najpierw telefon (390 px), potem komputer (1280 px). Jedna kolumna na telefonie, na komputerze treść + kolumna boczna.
- Zaokrąglenia: `radius-control` (10 px) dla przycisków i pól, `radius-card` (14 px) dla kart, `radius-panel` (16 px) dla ofert, `radius-pill` dla etykiet.
- Karty oddzielamy linią `line` 1 px, nigdy cieniem. Bez gradientów, bez kolorowego paska przy lewej krawędzi karty.
- Każdy element klikalny ma co najmniej `tap-target` (44 px), pola formularzy `field-height` (48 px).

## Ikony

- Zestaw Lucide, kontur, grubość domyślna. Rozmiary 16, 18, 20, 22 px. Kolor dziedziczony z tekstu.
- Ikona zawsze stoi obok słowa albo ma opis dla czytnika ekranu. Bez emoji.
- Symbole religijne (krzyż) pojawiają się tylko na klepsydrze i stronie pamięci, gdy rodzina wybrała ceremonię religijną. Nigdy w znaku ani w materiałach marki.

## Zdjęcia i grafika

- Zdjęcia w naturalnym, miękkim świetle: drzewa, ścieżki, światło w oknie, dłonie, faktury kamienia i drewna. Lekko zgaszone kolory, ciepła szarość.
- Nie pokazujemy trumien, płaczących ludzi, karawanów ani twarzy osób zmarłych. Bez czarnych teł z kwiatami.
- Jedyna grafika marki to znak i jego powiększony fragment (łuk z linią), w kolorach `brand-tint` i jasnego piasku, ucięty przez krawędź – jak na obrazie do udostępnień.

## Ruch

- Przejścia 150–200 ms, tylko zmiana koloru i przezroczystości. Bez animacji „sukcesu”, konfetti i podskakujących elementów.
- Pasek licznika 15 minut zmienia szerokość płynnie. Przy ustawieniu „ogranicz ruch” wszystkie przejścia są wyłączone.

## Dostępność

- Kontrast tekstu min. 4,5:1 w obu motywach (sprawdzone dla każdej pary w notatkach tokenów), elementy graficzne i obramowania pól 3:1 (`field`).
- Fokus klawiatury: obwódka `focus-ring` 3 px z odstępem 2 px.
- Prawdziwe przyciski, linki i etykiety pól; ekran działa także bez JavaScriptu tam, gdzie to możliwe (kreator zapytania).


## Znak i logo

### Koncepcja

Znak „Brama i droga” to dwie bramy, jedna za drugą, i prosta droga w osi symetrii. Zewnętrzny łuk (szałwia) to ostoja: schronienie i próg. Wewnętrzny, cieńszy łuk daje głębię – kolejny próg dalej, jak w perspektywie korytarza albo alei. Linia drogi (piasek) zaczyna się na progu i prowadzi w głąb – to ostatnia droga. Znak jest symetryczny, zbudowany z trzech linii o zaokrąglonych końcach i tych samych grubości co interfejs. Do 24 px używamy wersji małej, bez wewnętrznej bramy, żeby znak nie zlewał się w plamę.

### Konstrukcja (siatka 32 × 32)

| Element | Geometria | Grubość | Kolor |
| --- | --- | --- | --- |
| Brama zewnętrzna | półkole o promieniu 9,75 w osi x = 16, nogi do y = 28 | 2,5, zakończenia zaokrąglone | `brand` #3F5650 |
| Brama wewnętrzna | półkole o promieniu 5 w osi x = 16, nogi do y = 28 | 1,6 | `brand` #3F5650 |
| Droga | pionowa linia x = 16 od y = 21 do y = 28 (próg) | 2,2 | `sand` #A68B5B |
| Wersja mała (≤ 24 px) | tylko brama zewnętrzna (promień 10, grubość 3,4) i droga od 18 do 28,5 (grubość 3) | | jak wyżej |

Napis „Ostoja” to Newsreader 500 (rozmiar optyczny 48) zamieniony na krzywe. Wysokość wersalików = 0,56 wysokości znaku, odstęp znak–napis = 9/32 wysokości znaku, linia bazowa napisu na wysokości podstawy łuku. Pliki generuje `scripts/brand/build_logo.py` w repozytorium – zmiany w znaku wprowadzaj tylko tam.

### Wersje i pliki

| Plik | Kiedy |
| --- | --- |
| `ostoja-logo.svg` | podstawowa: na `ground-family`, `ground`, bieli |
| `ostoja-logo-pionowe.svg` | stopki dokumentów, naklejki, pieczątki, kwadratowe formaty |
| `ostoja-logo-ciemne-tlo.svg` | na `night` i `brand`: łuk i napis #E4E7E5, droga `sand-light` |
| `ostoja-logo-czarne.svg`, `ostoja-logo-biale.svg` | druk jednobarwny, grawer, faks, folia; biała – tylko na spokojnym fragmencie zdjęcia |
| `ostoja-znak.svg` | znak bez napisu, od 25 px |
| `ostoja-znak-maly.svg` | znak bez napisu, 16–24 px (ikona karty przeglądarki) |
| `ostoja-ikona-aplikacji.svg`, `-512.png`, `-192.png` | ikona aplikacji panelu na telefonie: znak jasny na `brand` |

### Pole ochronne i rozmiary

- Pole ochronne wokół logo = 1/4 wysokości znaku z każdej strony. Nic nie wchodzi w to pole: tekst, krawędź kartki, inne logo.
- Minimalnie: znak 16 px (ekran) / 6 mm (druk); logo poziome 96 px szerokości / 22 mm; logo pionowe 64 px / 16 mm.
- Na ekranie logo stoi przy lewej krawędzi nagłówka, wysokość znaku 30 px (strona) albo 26 px (panel, stopka).

### Czego nie robić

- Nie zmieniaj proporcji, grubości ani położenia drogi. Droga zawsze w osi, zawsze prosta i zawsze wychodzi przed próg.
- Nie dodawaj elementów: krzyża, płomienia, gwiazdy, liścia, ptaka, horyzontu, cienia, obrysu, gradientu.
- Nie zamieniaj kolorów (droga w szałwii, łuk w piasku) i nie używaj kolorów spoza palety.
- Nie stawiaj pełnokolorowego logo na zdjęciu ani na `sand` – na ciemnym tle używaj wersji na ciemne tło.
- Nie obracaj, nie pochylaj, nie zamykaj znaku w kółku. Ikona aplikacji to jedyny przypadek tła pod znakiem (kwadrat zaokrąglony 112/512).
- Nie składaj napisu innym krojem i nie pisz „OSTOJA” wersalikami.

### Znak partnera

Zakłady zweryfikowane przez Ostoję dostają naklejkę „Partner Ostoi” (`zastosowanie-naklejka-partnera.svg`, 120 × 120 mm): znak, napis Newsreader i jedno zdanie o zasadach. Zakład może jej używać na drzwiach, stronie i w stopce e-maila, obok własnego logo, z zachowaniem pola ochronnego. Logo Ostoi nie łączymy w jedno z logo zakładu.

## Ton i język

Piszemy jak spokojny, doświadczony człowiek, który zna się na rzeczy i ma czas. Krótkie zdania, konkretne liczby, jedna prośba naraz. Do rodzin i do zakładów zwracamy się na „Ty” (w listach i SMS-ach „Ty”, „Twój” wielką literą), bez zdrobnień i bez wykrzykników.

### Zasady

- **Najpierw to, co trzeba zrobić.** „Zakład oddzwoni w ciągu 15 minut.”, a dopiero potem wyjaśnienie.
- **Pełne kwoty i terminy.** „5 790 zł”, „pt., 16 października, 11:00”. Nigdy „od”, „już od”, gwiazdki ani „cena do ustalenia”, jeśli cenę znamy.
- **Bez sprzedaży.** Nie mówimy o promocjach, pakietach premium ani o „najlepszej ofercie”. Kolejności nie da się kupić i mówimy o tym wprost.
- **Bez patosu.** Jedno zdanie współczucia wystarczy, i tylko tam, gdzie rodzina pierwszy raz zostawia dane. Bez „pięknych pożegnań” i „godnych ceremonii” w każdym akapicie.
- **Błąd mówi, co zrobić.** „Numer konta ma 26 cyfr.”, „Ten karawan jest już zarezerwowany w tym czasie.” Bez „Ups”, bez przeprosin w kółko.
- **Zawsze człowiek pod telefonem.** Każdy ekran rodziny kończy się numerem opiekuna, w panelu – numerem opiekuna partnerów.

### Słownik

| Piszemy | Nie piszemy |
| --- | --- |
| osoba zmarła, zmarły, zmarła, Śp. (tylko na klepsydrze) | denat, nieboszczyk, ciało (poza kontekstem odbioru i chłodni) |
| pogrzeb, pożegnanie, ceremonia, pochówek | usługa funeralna, event, produkt |
| rodzina, osoba organizująca pogrzeb | klient, lead, kontakt |
| zakład, zakład pogrzebowy, partner Ostoi | dostawca, usługodawca |
| zapytanie, zlecenie, umowa | ticket, deal, transakcja |
| zasiłek pogrzebowy (7 000 zł z ZUS) | becikowe pogrzebowe, „pieniądze z ZUS-u” |
| opiekun Ostoi | konsultant, infolinia, bot |
| ostrzeżenie: „Pochówek wcześniej niż 24 godziny od zgonu” | „Błąd!”, „Niedozwolone” |

### Przykłady

| Zamiast | Piszemy |
| --- | --- |
| „Najlepsze ceny pogrzebów w Twojej okolicy! Sprawdź już teraz!” | „Porównaj pełne ceny zakładów pogrzebowych w swoim mieście.” |
| „Pakiet Premium od 3 999 zł*” | „Kremacja z ceremonią religijną – 5 790 zł. Z zasiłku zostaje 1 210 zł.” |
| „Twoje zgłoszenie zostało przyjęte do realizacji.” | „Zapytanie wysłane. Dom Pogrzebowy Cisza oddzwoni w ciągu 15 minut.” |
| „Nowy lead czeka!” | „Nowe zapytanie. Odpowiedz w 15 minut.” |
| „Wystąpił błąd walidacji pola IBAN.” | „Numer konta ma 26 cyfr.” |

### SMS do rodziny (wzór)

> Dzień dobry, tu Dom Pogrzebowy Cisza. Pod tym linkiem zobaczysz terminy i koszty oraz uzupełnisz dane do dokumentów: [adres Ostoi]/r/… W razie pytań: 600 000 001.

SMS z polskimi literami mieści 70 znaków na część (bez nich 160), więc ten wzór to 3 części. Jeśli liczy się koszt, cały SMS piszemy bez polskich liter – nigdy wybiórczo. Nadawca: nazwa zakładu, nie „Ostoja”.

## Zastosowania

### Strona dla rodzin

- Tło `ground-family`, nagłówek z logo poziomym (znak 30 px) i numerem opiekuna po prawej. Stopka na `night` z logo na ciemne tło.
- Jedno zdanie w stylu `display`, pod nim `body` w `muted` i jeden przycisk główny. Obok – karta przykładowej oferty, nie zdjęcie.
- Oferty: karty `radius-panel` na `card`, nazwa zakładu `h2`, kwota `price`, pod nią „Z zasiłku zostaje …” w `brand` albo „Dopłata ponad zasiłek …” w `warn-ink`.

### Panel zakładu

- Nagłówek `night`, w kafelku `brand` znak jasny (26 px), obok nazwa zakładu i osoba. Tło `ground`.
- Nowe zapytanie: karta z obramowaniem `warn` 2 px na całym obwodzie, etykieta `label` w `warn-ink`, licznik 15 minut z paskiem `warn` na `warn-tint`.
- Ikona aplikacji na telefonie: `ostoja-ikona-512.png`, kolor motywu przeglądarki `night`.

### Dokumenty

- **Klepsydra** (A4, druk z przeglądarki): ramka czarna 6 mm, imię i nazwisko w `memorial`, reszta Newsreader. Krzyż i „Śp.” tylko przy ceremonii religijnej. U dołu drobno nazwa i telefon zakładu – bez logo Ostoi, klepsydra należy do rodziny i zakładu.
- **Kosztorys i umowa**: logo zakładu u góry, w stopce „Przygotowano w Ostoi” małym logo poziomym (22 mm).

### Materiały firmowe

- **Wizytówka** 85 × 55 mm (`zastosowanie-wizytowka.svg`): przód biały – logo poziome, imię `card-title`, rola i kontakt `small`; tył `brand` – znak jasny na środku i jedno zdanie Newsreader: „Pomagamy przejść przez to spokojnie.” Papier niepowlekany, gramatura 350 g, bez lakieru i złoceń.
- **Naklejka „Partner Ostoi”** 120 × 120 mm (`zastosowanie-naklejka-partnera.svg`) na drzwi i witrynę zakładu, folia matowa.
- **Podpis e-mail**: imię i nazwisko (Figtree 600), rola, telefon, logo poziome 120 px. Bez cytatów i bannerów.

### Internet

- **Obraz do udostępnień** 1200 × 630 (`opengraph-image.png`): tło `ground-family`, logo, jedno zdanie `display`, powiększony znak w `brand-tint` i jasnym piasku ucięty przez prawy dolny róg.
- **Awatar w mediach społecznościowych**: ikona aplikacji (znak jasny na `brand`).
- **Ikona karty przeglądarki**: `ostoja-znak-maly.svg`.
